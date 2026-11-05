import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serializeEnvelope,
  parseEnvelope,
  TGHO_KIND_TEXT,
  TGHO_KIND_BINARY,
  type TghoEnvelope,
} from '../../src/dsp/envelope';
import { encodeSamples } from '../../src/dsp/fsk';
import { decodeWav } from '../../src/dsp/decoder';
import { crc32 } from '../../src/dsp/crc32';
import {
  HAND_DERIVED_KIND,
  HAND_DERIVED_FILENAME,
  HAND_DERIVED_PAYLOAD,
} from '../fixtures/independent/hand-derived-48k';

const SEED = 42;

function encodeEnvelope(env: TghoEnvelope): Int16Array {
  const bytes = serializeEnvelope(env);
  if (!(bytes instanceof Uint8Array)) throw new Error('serialize failed: ' + JSON.stringify(bytes));
  return encodeSamples(bytes);
}

function roundTripBinary(payload: Uint8Array, filename: Uint8Array): Uint8Array | null {
  const samples = encodeEnvelope({
    version: 1,
    kind: TGHO_KIND_BINARY,
    filenameBytes: filename,
    payloadBytes: payload,
  });
  const result = decodeWav({ samples, sampleRate: 48000 });
  return result.ok ? result.payloadBytes : null;
}

// Feature: tapeghost-mvp, Property 2: Encode/Decode Audio Round Trip — Binary Payloads
describe('audio round-trip PBT — binary (Kind=1)', () => {
  it('any 0–1024 byte payload survives encode→decode', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 1024 }),
        fc.uint8Array({ minLength: 0, maxLength: 64 }),
        (payload, filename) => {
          const recovered = roundTripBinary(payload, filename);
          if (recovered === null) return false;
          return Array.from(recovered).join(',') === Array.from(payload).join(',');
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});

// Feature: tapeghost-mvp, Property 3: Encode/Decode Audio Round Trip — Text Payloads
describe('audio round-trip PBT — text (Kind=0, valid UTF-8)', () => {
  it('any valid UTF-8 string ≤ 1024 bytes survives encode→decode', () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const payload = new TextEncoder().encode(str);
        if (payload.length > 1024) return true; // out of domain; skip
        const samples = encodeEnvelope({
          version: 1,
          kind: TGHO_KIND_TEXT,
          filenameBytes: new Uint8Array(0),
          payloadBytes: payload,
        });
        const result = decodeWav({ samples, sampleRate: 48000 });
        if (!result.ok) return false;
        return Array.from(result.payloadBytes).join(',') === Array.from(payload).join(',');
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

// Feature: tapeghost-mvp, Property 4: Short Binary Payload Coverage
describe('audio round-trip PBT — short payloads (1–16 bytes)', () => {
  it('short binary payloads survive round trip', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 16 }), (payload) => {
        const recovered = roundTripBinary(payload, new Uint8Array(0));
        if (recovered === null) return false;
        return Array.from(recovered).join(',') === Array.from(payload).join(',');
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

describe('explicit boundary payload lengths', () => {
  for (const len of [0, 1, 255, 256, 1023, 1024]) {
    it(`payload of ${len} bytes round-trips`, () => {
      const payload = new Uint8Array(len);
      for (let i = 0; i < len; i++) payload[i] = i & 0xff;
      const recovered = roundTripBinary(payload, new Uint8Array(0));
      expect(recovered).not.toBeNull();
      expect(Array.from(recovered as Uint8Array)).toEqual(Array.from(payload));
    });
  }
});

describe('Unicode text payloads', () => {
  it('Romanian diacritic "ă" (U+0103, UTF-8 0xC4 0x83) round-trips', () => {
    const payload = new TextEncoder().encode('ă');
    expect(Array.from(payload)).toEqual([0xc4, 0x83]);
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(new TextDecoder().decode(result.payloadBytes)).toBe('ă');
    }
  });

  it('emoji "💾" (U+1F4BE, UTF-8 0xF0 0x9F 0x92 0xBE) round-trips', () => {
    const payload = new TextEncoder().encode('💾');
    expect(Array.from(payload)).toEqual([0xf0, 0x9f, 0x92, 0xbe]);
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(new TextDecoder().decode(result.payloadBytes)).toBe('💾');
  });
});

describe('independently authored fixture', () => {
  it('recovers the hand-derived payload bytes exactly', () => {
    const samples = encodeEnvelope({
      version: 1,
      kind: HAND_DERIVED_KIND,
      filenameBytes: HAND_DERIVED_FILENAME,
      payloadBytes: HAND_DERIVED_PAYLOAD,
    });
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.payloadBytes)).toEqual(Array.from(HAND_DERIVED_PAYLOAD));
      expect(Array.from(result.filenameBytes)).toEqual(Array.from(HAND_DERIVED_FILENAME));
    }
  });
});

describe('CRC mismatch — two paths (Req 17.1)', () => {
  it('Test A (audio path): mutated payload byte with intact CRC → crc-mismatch', () => {
    const payload = new Uint8Array([10, 20, 30, 40]);
    const envBytes = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    if (!(envBytes instanceof Uint8Array)) throw new Error('serialize failed');
    const mutated = envBytes.slice();
    mutated[12] ^= 0x01; // mutate first payload byte; CRC field unchanged
    const samples = encodeSamples(mutated);
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('crc-mismatch');
  });

  it('Test B (parser path): same mutation directly to parseEnvelope → crc-mismatch', () => {
    const payload = new Uint8Array([10, 20, 30, 40]);
    const envBytes = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    if (!(envBytes instanceof Uint8Array)) throw new Error('serialize failed');
    const mutated = envBytes.slice();
    mutated[12] ^= 0x01;
    const result = parseEnvelope(mutated);
    expect('payloadBytes' in result).toBe(false);
    expect((result as { kind: string }).kind).toBe('crc-mismatch');
  });

  it('sanity: crc32 KAT still holds', () => {
    expect(crc32(new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]))).toBe(
      0xcbf43926,
    );
  });
});

describe('performance instrumentation (Req 13)', () => {
  it('max-payload round trip completes and logs wall-clock', () => {
    const payload = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) payload[i] = (i * 7) & 0xff;
    const t0 = performance.now();
    const recovered = roundTripBinary(payload, new Uint8Array(0));
    const ms = performance.now() - t0;
     
    console.log(`[perf] max-payload (1024B) encode+decode wall-clock: ${ms.toFixed(1)} ms`);
    expect(recovered).not.toBeNull();
    expect(Array.from(recovered as Uint8Array)).toEqual(Array.from(payload));
    // Test guard, not the production 2s target: must be well under 30s.
    expect(ms).toBeLessThan(30000);
  });
});
