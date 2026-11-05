import { describe, it, expect } from 'vitest';
import { formatError, isTghoError, type TghoError } from '../../src/dsp/errors';
import {
  serializeEnvelope,
  TGHO_KIND_TEXT,
  TGHO_KIND_BINARY,
  type TghoEnvelope,
} from '../../src/dsp/envelope';

describe('encoder input validation (rejection paths)', () => {
  it('payload length 1025 → payload-length-overflow with correct length', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array(1025),
    };
    const result = serializeEnvelope(env);
    expect(isTghoError(result)).toBe(true);
    const err = result as TghoError;
    expect(err.kind).toBe('payload-length-overflow');
    if (err.kind === 'payload-length-overflow') {
      expect(err.length).toBe(1025);
    }
  });

  it('filename length 65 → filename-length-overflow with correct length', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(65),
      payloadBytes: new Uint8Array(0),
    };
    const result = serializeEnvelope(env);
    const err = result as TghoError;
    expect(err.kind).toBe('filename-length-overflow');
    if (err.kind === 'filename-length-overflow') {
      expect(err.length).toBe(65);
    }
  });

  it('Kind=0 with non-empty filename → filename-in-text-envelope', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new TextEncoder().encode('bad.txt'),
      payloadBytes: new Uint8Array(0),
    };
    const result = serializeEnvelope(env);
    expect((result as TghoError).kind).toBe('filename-in-text-envelope');
  });

  it('does not throw an unhandled exception on invalid input', () => {
    expect(() =>
      serializeEnvelope({
        version: 1,
        kind: TGHO_KIND_BINARY,
        filenameBytes: new Uint8Array(0),
        payloadBytes: new Uint8Array(2000),
      }),
    ).not.toThrow();
  });

  it('maximum valid payload (1024 bytes) is accepted', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array(1024),
    };
    const result = serializeEnvelope(env);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('maximum valid filename (64 bytes) is accepted', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(64),
      payloadBytes: new Uint8Array(0),
    };
    const result = serializeEnvelope(env);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

describe('formatError completeness', () => {
  it('returns a non-empty, distinct string for every error kind', () => {
    const errors: TghoError[] = [
      { kind: 'oversized-file', byteCount: 9_000_000 },
      { kind: 'unsupported-wav-profile', detail: 'stereo audio: 2 channels' },
      { kind: 'no-carrier' },
      { kind: 'sync-failure' },
      { kind: 'framing-error' },
      { kind: 'magic-mismatch' },
      { kind: 'unsupported-version', version: 2 },
      { kind: 'unknown-kind', value: 5 },
      { kind: 'filename-length-overflow', length: 65 },
      { kind: 'payload-length-overflow', length: 1025 },
      { kind: 'truncation' },
      { kind: 'crc-mismatch' },
      { kind: 'utf8-encoding-error' },
      { kind: 'filename-in-text-envelope' },
      { kind: 'internal-error', detail: 'boom' },
    ];
    const messages = errors.map(formatError);
    for (const msg of messages) {
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
    // All messages must be distinct (each error kind is distinguishable)
    const unique = new Set(messages);
    expect(unique.size).toBe(messages.length);
  });

  it('isTghoError type guard works', () => {
    expect(isTghoError({ kind: 'no-carrier' })).toBe(true);
    expect(isTghoError(new Uint8Array(5))).toBe(false);
    expect(isTghoError(null)).toBe(false);
    expect(isTghoError('string')).toBe(false);
  });
});

import { decodeWav } from '../../src/dsp/decoder';
import { parseWav } from '../../src/dsp/wav';
import { encodeSamples } from '../../src/dsp/fsk';
import { parseEnvelope } from '../../src/dsp/envelope';
import { crc32 } from '../../src/dsp/crc32';

/** Build a WAV with custom fmt fields for rejection testing. */
function makeWav(opts: {
  audioFormat?: number;
  numChannels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  dataBytes?: number;
}): ArrayBuffer {
  const audioFormat = opts.audioFormat ?? 1;
  const numChannels = opts.numChannels ?? 1;
  const sampleRate = opts.sampleRate ?? 48000;
  const bitsPerSample = opts.bitsPerSample ?? 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataBytes = opts.dataBytes ?? 0;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  w(36, 'data');
  view.setUint32(40, dataBytes, true);
  return buffer;
}

describe('decode-path rejection (Req 8, Req 17)', () => {
  it('silence (all-zero samples) → no-carrier', () => {
    const result = decodeWav({ samples: new Int16Array(300000), sampleRate: 48000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no-carrier');
  });

  it('parseWav rejects stereo with detail "2 channels"', () => {
    const r = parseWav(makeWav({ numChannels: 2, dataBytes: 8 }));
    expect('kind' in r && r.kind).toBe('unsupported-wav-profile');
    if ('detail' in r) expect(r.detail).toContain('2 channels');
  });

  it('parseWav rejects non-PCM (format tag 3)', () => {
    const r = parseWav(makeWav({ audioFormat: 3, dataBytes: 8 }));
    if ('detail' in r) expect(r.detail).toContain('unsupported format tag: 3');
  });

  it('parseWav rejects 22050 Hz', () => {
    const r = parseWav(makeWav({ sampleRate: 22050, dataBytes: 8 }));
    if ('detail' in r) expect(r.detail).toContain('unsupported sample rate: 22050');
  });

  it('parseWav rejects 8-bit depth', () => {
    const r = parseWav(makeWav({ bitsPerSample: 8, dataBytes: 8 }));
    if ('detail' in r) expect(r.detail).toContain('unsupported bit depth: 8');
  });

  it('parseWav rejects oversized file', () => {
    const r = parseWav(new ArrayBuffer(8 * 1024 * 1024 + 1));
    expect('kind' in r && r.kind).toBe('oversized-file');
  });

  it('truncated envelope (1 byte removed after PL field) → truncation', () => {
    // Build a valid envelope, then truncate the byte array before encoding
    const env = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array([1, 2, 3, 4, 5]),
    });
    if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
    // Remove the last byte (part of CRC) → parseEnvelope truncation
    const truncated = env.subarray(0, env.length - 1);
    const result = parseEnvelope(truncated);
    expect('payloadBytes' in result).toBe(false);
    expect((result as { kind: string }).kind).toBe('truncation');
  });

  it('unsupported version 0, 2, 255 → unsupported-version', () => {
    for (const v of [0, 2, 255]) {
      const env = serializeEnvelope({
        version: 1,
        kind: TGHO_KIND_BINARY,
        filenameBytes: new Uint8Array(0),
        payloadBytes: new Uint8Array([9]),
      });
      if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
      const bytes = env.slice();
      bytes[4] = v;
      const result = parseEnvelope(bytes) as { kind: string; version?: number };
      expect(result.kind).toBe('unsupported-version');
      expect(result.version).toBe(v);
    }
  });

  it('Payload Length field 1025 → payload-length-overflow', () => {
    const env = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array([1]),
    });
    if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
    const bytes = env.slice();
    new DataView(bytes.buffer).setUint32(8, 1025, true);
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('payload-length-overflow');
  });

  it('maximum valid Payload Length 1024 decodes without error (full audio path)', () => {
    const payload = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) payload[i] = i & 0xff;
    const env = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
    const samples = encodeSamples(env);
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.payloadBytes)).toEqual(Array.from(payload));
  });

  it('Kind=0 with invalid UTF-8 byte (0xFF) → utf8-encoding-error (full audio path)', () => {
    // Serialize a Kind=0 envelope whose payload is a raw 0xFF byte. The
    // serializer does not UTF-8-validate, so this builds a signal that the
    // decoder must reject at the parseEnvelope UTF-8 step.
    const env = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array([0xff]),
    });
    if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
    const samples = encodeSamples(env);
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('utf8-encoding-error');
  });

  it('no decode-path rejection throws an unhandled exception', () => {
    expect(() => decodeWav({ samples: new Int16Array(300000), sampleRate: 48000 })).not.toThrow();
    expect(() => parseWav(makeWav({ numChannels: 2, dataBytes: 8 }))).not.toThrow();
    expect(() => parseEnvelope(new Uint8Array(3))).not.toThrow();
  });

  it('crc32 KAT sanity', () => {
    expect(
      crc32(new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39])),
    ).toBe(0xcbf43926);
  });
});
