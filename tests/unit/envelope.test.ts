import { describe, it, expect } from 'vitest';
import { crc32 } from '../../src/dsp/crc32';

describe('crc32', () => {
  it('known-answer test: CRC-32/ISO-HDLC of "123456789" = 0xCBF43926', () => {
    const input = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]);
    expect(crc32(input)).toBe(0xcbf43926);
  });

  it('empty input returns 0x00000000', () => {
    expect(crc32(new Uint8Array([]))).toBe(0x00000000);
  });

  it('single zero byte', () => {
    expect(crc32(new Uint8Array([0x00]))).toBe(0xd202ef8d);
  });
});

import {
  serializeEnvelope,
  formatError,
  TGHO_KIND_TEXT,
  TGHO_KIND_BINARY,
  type TghoEnvelope,
} from '../../src/dsp/envelope';

describe('serializeEnvelope', () => {
  it('Kind=0 empty payload produces correct header', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array(0),
    };
    const result = serializeEnvelope(env);
    expect(result).toBeInstanceOf(Uint8Array);
    const buf = result as Uint8Array;
    // Magic
    expect(buf[0]).toBe(0x54); // T
    expect(buf[1]).toBe(0x47); // G
    expect(buf[2]).toBe(0x48); // H
    expect(buf[3]).toBe(0x4f); // O
    // Version
    expect(buf[4]).toBe(1);
    // Kind
    expect(buf[5]).toBe(0);
    // Filename Length (uint16 LE) = 0
    const view = new DataView(buf.buffer);
    expect(view.getUint16(6, true)).toBe(0);
    // Payload Length (uint32 LE) = 0
    expect(view.getUint32(8, true)).toBe(0);
    // Total size = 16 bytes (12 header + 0 FL + 0 PL + 4 CRC)
    expect(buf.length).toBe(16);
  });

  it('Kind=0 with text payload sets correct lengths', () => {
    const payload = new TextEncoder().encode('hello');
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    };
    const result = serializeEnvelope(env);
    expect(result).toBeInstanceOf(Uint8Array);
    const buf = result as Uint8Array;
    const view = new DataView(buf.buffer);
    expect(view.getUint16(6, true)).toBe(0); // FL = 0
    expect(view.getUint32(8, true)).toBe(5); // PL = 5
    expect(buf.length).toBe(12 + 0 + 5 + 4); // 21 bytes
  });

  it('Kind=1 with filename sets correct lengths', () => {
    const filename = new TextEncoder().encode('test.bin');
    const payload = new Uint8Array([0x00, 0xff, 0x42]);
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: filename,
      payloadBytes: payload,
    };
    const result = serializeEnvelope(env);
    expect(result).toBeInstanceOf(Uint8Array);
    const buf = result as Uint8Array;
    const view = new DataView(buf.buffer);
    expect(buf[5]).toBe(1); // Kind = 1
    expect(view.getUint16(6, true)).toBe(8); // FL = 8 (length of "test.bin")
    expect(view.getUint32(8, true)).toBe(3); // PL = 3
    expect(buf.length).toBe(12 + 8 + 3 + 4); // 27 bytes
  });

  it('Payload bytes are preserved exactly including null bytes', () => {
    const payload = new Uint8Array([0x00, 0x01, 0xff, 0xa5]);
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    };
    const result = serializeEnvelope(env) as Uint8Array;
    expect(result[12]).toBe(0x00);
    expect(result[13]).toBe(0x01);
    expect(result[14]).toBe(0xff);
    expect(result[15]).toBe(0xa5);
  });

  it('rejects Kind=0 with non-empty filename', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new TextEncoder().encode('bad.txt'),
      payloadBytes: new Uint8Array(0),
    };
    const result = serializeEnvelope(env);
    expect(result).not.toBeInstanceOf(Uint8Array);
    expect((result as { kind: string }).kind).toBe('filename-in-text-envelope');
  });

  it('rejects filename longer than 64 bytes', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(65),
      payloadBytes: new Uint8Array(0),
    };
    const result = serializeEnvelope(env);
    expect((result as { kind: string }).kind).toBe('filename-length-overflow');
  });

  it('rejects payload longer than 1024 bytes', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array(1025),
    };
    const result = serializeEnvelope(env);
    expect((result as { kind: string }).kind).toBe('payload-length-overflow');
  });
});

describe('formatError', () => {
  it('returns a non-empty string for every TghoError kind', () => {
    const errors: Parameters<typeof formatError>[0][] = [
      { kind: 'oversized-file', byteCount: 9_000_000 },
      { kind: 'unsupported-wav-profile', detail: 'test detail' },
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
    for (const err of errors) {
      const msg = formatError(err);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it('distinguishes crc-mismatch from framing-error (Req 8.7)', () => {
    const crcMsg = formatError({ kind: 'crc-mismatch' });
    const framingMsg = formatError({ kind: 'framing-error' });
    expect(crcMsg).not.toBe(framingMsg);
  });
});

import * as fc from 'fast-check';
import { parseEnvelope, sanitizeFilename } from '../../src/dsp/envelope';

const SEED = 42;

describe('parseEnvelope — validation', () => {
  function validEnvelope(kind: 0 | 1, payload: Uint8Array, filename: Uint8Array): Uint8Array {
    const result = serializeEnvelope({
      version: 1,
      kind,
      filenameBytes: filename,
      payloadBytes: payload,
    });
    if (!(result instanceof Uint8Array)) throw new Error('serialize failed');
    return result;
  }

  it('truncated (< 12 bytes) → truncation', () => {
    expect(parseEnvelope(new Uint8Array(5))).toEqual({ kind: 'truncation' });
  });

  it('wrong magic → magic-mismatch', () => {
    const bytes = validEnvelope(1, new Uint8Array([1, 2, 3]), new Uint8Array(0));
    bytes[0] = 0x58; // corrupt magic
    expect((parseEnvelope(bytes) as { kind: string }).kind).toBe('magic-mismatch');
  });

  it('version 0, 2, 255 → unsupported-version with correct value', () => {
    for (const v of [0, 2, 255]) {
      const bytes = validEnvelope(1, new Uint8Array([1]), new Uint8Array(0));
      bytes[4] = v;
      const result = parseEnvelope(bytes) as { kind: string; version?: number };
      expect(result.kind).toBe('unsupported-version');
      expect(result.version).toBe(v);
    }
  });

  it('kind 2, 255 → unknown-kind with correct value', () => {
    for (const k of [2, 255]) {
      const bytes = validEnvelope(1, new Uint8Array([1]), new Uint8Array(0));
      bytes[5] = k;
      // corrupting kind invalidates CRC, but kind check (step 3) precedes CRC (step 7)
      const result = parseEnvelope(bytes) as { kind: string; value?: number };
      expect(result.kind).toBe('unknown-kind');
      expect(result.value).toBe(k);
    }
  });

  it('filename length > 64 → filename-length-overflow', () => {
    const bytes = validEnvelope(1, new Uint8Array([1]), new Uint8Array(0));
    const view = new DataView(bytes.buffer);
    view.setUint16(6, 65, true); // declare FL = 65
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('filename-length-overflow');
  });

  it('payload length > 1024 → payload-length-overflow', () => {
    const bytes = validEnvelope(1, new Uint8Array([1]), new Uint8Array(0));
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 1025, true);
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('payload-length-overflow');
  });

  it('declared lengths exceed available bytes → truncation', () => {
    const bytes = validEnvelope(1, new Uint8Array([1, 2, 3]), new Uint8Array(0));
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 1000, true); // declare PL=1000 but bytes absent
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('truncation');
  });

  it('mutated payload byte (CRC intact) → crc-mismatch', () => {
    const bytes = validEnvelope(1, new Uint8Array([10, 20, 30]), new Uint8Array(0));
    bytes[12] ^= 0x01; // flip a payload bit; CRC field unchanged
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('crc-mismatch');
  });

  it('Kind=0 with FL > 0 → filename-in-text-envelope', () => {
    // Build a Kind=1 envelope with a filename, then flip kind to 0 and fix CRC
    const payload = new TextEncoder().encode('hi');
    const filename = new TextEncoder().encode('f.txt');
    const bytes = validEnvelope(1, payload, filename);
    bytes[5] = 0; // kind → 0
    // recompute CRC so we reach step 8 (not crc-mismatch)
    const fl = 5;
    const pl = 2;
    const view = new DataView(bytes.buffer);
    view.setUint32(12 + fl + pl, crc32(bytes.subarray(0, 12 + fl + pl)), true);
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('filename-in-text-envelope');
  });

  it('Kind=0 with invalid UTF-8 payload (0xFF) → utf8-encoding-error', () => {
    const bytes = validEnvelope(0, new Uint8Array([0xff]), new Uint8Array(0));
    const result = parseEnvelope(bytes) as { kind: string };
    expect(result.kind).toBe('utf8-encoding-error');
  });

  it('empty payload (PL=0, FL=0) parses without error', () => {
    const bytes = validEnvelope(0, new Uint8Array(0), new Uint8Array(0));
    const result = parseEnvelope(bytes);
    expect('version' in result).toBe(true);
  });
});

describe('sanitizeFilename', () => {
  it('strips path separators', () => {
    expect(sanitizeFilename(new TextEncoder().encode('a/b\\c.txt'))).toBe('abc.txt');
  });
  it('strips leading dots', () => {
    expect(sanitizeFilename(new TextEncoder().encode('../etc/passwd'))).toBe('etcpasswd');
  });
  it('falls back to recovered_file when empty', () => {
    expect(sanitizeFilename(new Uint8Array(0))).toBe('recovered_file');
  });
  it('strips control characters', () => {
    expect(sanitizeFilename(new Uint8Array([0x61, 0x00, 0x62]))).toBe('ab');
  });
});

// Feature: tapeghost-mvp, Property 1: Envelope Serialization Round Trip
// Validates: Requirements 2.1, 2.2
describe('envelope round-trip property', () => {
  it('parse(serialize(env)) equals env for Kind=1 binary', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 1024 }),
        fc.uint8Array({ minLength: 0, maxLength: 64 }),
        (payload, filename) => {
          const ser = serializeEnvelope({
            version: 1,
            kind: 1,
            filenameBytes: filename,
            payloadBytes: payload,
          });
          if (!(ser instanceof Uint8Array)) return false;
          const parsed = parseEnvelope(ser);
          if (!('version' in parsed)) return false;
          return (
            parsed.kind === 1 &&
            Array.from(parsed.filenameBytes).join(',') === Array.from(filename).join(',') &&
            Array.from(parsed.payloadBytes).join(',') === Array.from(payload).join(',')
          );
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
