import { describe, it, expect } from 'vitest';
import {
  classifyBitPeriod,
  acquireCarrier,
  alignSymbols,
  frameByte,
  decodeWav,
  samplesPerBitFor,
  CARRIER_MIN_BITS,
} from '../../src/dsp/decoder';
import { encodeSamples, SAMPLES_PER_BIT, writeBitInto } from '../../src/dsp/fsk';
import {
  serializeEnvelope,
  TGHO_KIND_TEXT,
  TGHO_KIND_BINARY,
  type TghoEnvelope,
} from '../../src/dsp/envelope';

function encodeEnvelope(env: TghoEnvelope): Int16Array {
  const bytes = serializeEnvelope(env);
  if (!(bytes instanceof Uint8Array)) throw new Error('serialize failed');
  return encodeSamples(bytes);
}

describe('classifyBitPeriod', () => {
  it('classifies a 2400 Hz bit as one', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    writeBitInto(1, 0, dest, 0, 48000);
    expect(classifyBitPeriod(dest, 0, SAMPLES_PER_BIT, 48000)).toBe('one');
  });
  it('classifies a 1200 Hz bit as zero', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    writeBitInto(0, 0, dest, 0, 48000);
    expect(classifyBitPeriod(dest, 0, SAMPLES_PER_BIT, 48000)).toBe('zero');
  });
  it('returns ambiguous when out of bounds', () => {
    const dest = new Int16Array(100);
    expect(classifyBitPeriod(dest, 50, SAMPLES_PER_BIT, 48000)).toBe('ambiguous');
  });
  it('returns ambiguous for silence', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    expect(classifyBitPeriod(dest, 0, SAMPLES_PER_BIT, 48000)).toBe('ambiguous');
  });
});

describe('acquireCarrier', () => {
  it('all-silence → no-carrier', () => {
    const silence = new Int16Array(300000);
    const r = acquireCarrier(silence, 48000);
    expect('kind' in r && r.kind).toBe('no-carrier');
  });
  it('full encoded signal → carrier acquired', () => {
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new TextEncoder().encode('hi'),
    });
    const r = acquireCarrier(samples, 48000);
    expect('coarseCarrierEndSample' in r).toBe(true);
  });
  it('CARRIER_MIN_BITS is 900', () => {
    expect(CARRIER_MIN_BITS).toBe(900);
  });
  it('44.1 kHz carrier minimum samples = 132300', () => {
    expect(CARRIER_MIN_BITS * samplesPerBitFor(44100)).toBe(132300);
  });
});

describe('full round-trip via decodeWav', () => {
  it('recovers a short text payload (48 kHz)', () => {
    const payload = new TextEncoder().encode('hello');
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.payloadBytes)).toEqual(Array.from(payload));
      expect(result.crcVerified).toBe(true);
    }
  });

  it('recovers binary payload with null bytes', () => {
    const payload = new Uint8Array([0x00, 0xff, 0x01, 0xa5, 0x00]);
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new TextEncoder().encode('f.bin'),
      payloadBytes: payload,
    });
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.payloadBytes)).toEqual(Array.from(payload));
  });

  it('recovers empty payload', () => {
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new Uint8Array(0),
    });
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payloadBytes.length).toBe(0);
  });

  it('recovers with leading silence (0.5 s)', () => {
    const payload = new TextEncoder().encode('test');
    const body = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    const silence = 24000; // 0.5 s at 48k
    const withSilence = new Int16Array(silence + body.length);
    withSilence.set(body, silence);
    const result = decodeWav({ samples: withSilence, sampleRate: 48000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Array.from(result.payloadBytes)).toEqual(Array.from(payload));
  });
});

describe('symbol alignment — all sub-bit offsets (48 kHz)', () => {
  it('recovers magic regardless of leading-silence offset 0..159', () => {
    const payload = new TextEncoder().encode('X');
    const body = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    let failures = 0;
    for (let offset = 0; offset < 160; offset++) {
      const padded = new Int16Array(offset + body.length);
      padded.set(body, offset);
      const result = decodeWav({ samples: padded, sampleRate: 48000 });
      if (!result.ok || Array.from(result.payloadBytes).join() !== Array.from(payload).join()) {
        failures++;
      }
    }
    expect(failures).toBe(0);
  });
});

describe('frameByte and alignSymbols', () => {
  it('frameByte recovers the first envelope byte (TGHO magic T = 0x54)', () => {
    const samples = encodeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: new TextEncoder().encode('z'),
    });
    const carrier = acquireCarrier(samples, 48000);
    expect('coarseCarrierEndSample' in carrier).toBe(true);
    if (!('coarseCarrierEndSample' in carrier)) return;
    const align = alignSymbols(samples, carrier.coarseCarrierEndSample, 48000);
    expect('dataBitOffset' in align).toBe(true);
    if (!('dataBitOffset' in align)) return;
    const r = frameByte(samples, align.dataBitOffset, SAMPLES_PER_BIT, 48000);
    expect('byte' in r).toBe(true);
    if ('byte' in r) expect(r.byte).toBe(0x54); // 'T'
  });

  it('frameByte returns truncation when the window runs past the buffer', () => {
    const tiny = new Int16Array(5 * SAMPLES_PER_BIT);
    const r = frameByte(tiny, 0, SAMPLES_PER_BIT, 48000);
    expect('kind' in r && r.kind).toBe('truncation');
  });
});

describe('decode errors', () => {
  it('silence → no-carrier', () => {
    const result = decodeWav({ samples: new Int16Array(300000), sampleRate: 48000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('no-carrier');
  });

  it('CRC mismatch: mutate payload byte in encoded envelope', () => {
    const payload = new Uint8Array([10, 20, 30]);
    const envBytes = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_BINARY,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    if (!(envBytes instanceof Uint8Array)) throw new Error('serialize failed');
    envBytes[12] ^= 0x01; // mutate first payload byte, leave CRC field
    const samples = encodeSamples(envBytes);
    const result = decodeWav({ samples, sampleRate: 48000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('crc-mismatch');
  });
});
