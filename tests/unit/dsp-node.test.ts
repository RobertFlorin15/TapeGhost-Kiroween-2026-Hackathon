import { describe, it, expect } from 'vitest';
import { crc32 } from '../../src/dsp/crc32';
import { serializeEnvelope, TGHO_KIND_BINARY, type TghoEnvelope } from '../../src/dsp/envelope';
import { byteToFrameBits, frameBitsToByte } from '../../src/dsp/framing';
import { writeBitInto, encodeSamples } from '../../src/dsp/fsk';
import { buildWav } from '../../src/dsp/wav';
import { formatError } from '../../src/dsp/errors';

/**
 * This test enforces the module independence rule: the DSP layer must run in a
 * plain Node.js process with NO browser globals. The vitest config sets
 * environment: 'node' for tests/unit/**, so window/document/AudioContext/Canvas
 * are genuinely absent here. If any DSP module referenced one at import or call
 * time, this file would throw a ReferenceError.
 */
describe('DSP Node.js testability', () => {
  it('browser globals are genuinely absent in this environment', () => {
    expect(typeof (globalThis as Record<string, unknown>).window).toBe('undefined');
    expect(typeof (globalThis as Record<string, unknown>).document).toBe('undefined');
    expect(typeof (globalThis as Record<string, unknown>).AudioContext).toBe('undefined');
    // Canvas / HTMLCanvasElement are also absent
    expect(typeof (globalThis as Record<string, unknown>).HTMLCanvasElement).toBe('undefined');
  });

  it('crc32 runs in Node', () => {
    expect(crc32(new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]))).toBe(
      0xcbf43926,
    );
  });

  it('serializeEnvelope runs in Node', () => {
    const env: TghoEnvelope = {
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array([1, 2, 3]),
    };
    const result = serializeEnvelope(env);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('framing runs in Node', () => {
    expect(frameBitsToByte(byteToFrameBits(0xa5))).toBe(0xa5);
  });

  it('writeBitInto and encodeSamples run in Node', () => {
    const dest = new Int16Array(160);
    const next = writeBitInto(1, 0, dest, 0, 48000);
    expect(typeof next).toBe('number');
    const samples = encodeSamples(new Uint8Array([0x42]));
    expect(samples).toBeInstanceOf(Int16Array);
    expect(samples.length).toBe(240000 + 11 * 160);
  });

  it('buildWav runs in Node', () => {
    const buf = buildWav(new Int16Array([0, 1, 2]), 48000);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(44 + 6);
  });

  it('formatError runs in Node', () => {
    expect(formatError({ kind: 'no-carrier' })).toContain('carrier');
  });
});
