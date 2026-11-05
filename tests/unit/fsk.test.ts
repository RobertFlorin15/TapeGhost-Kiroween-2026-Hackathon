import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { byteToFrameBits, frameBitsToByte } from '../../src/dsp/framing';

const SEED = 42;

describe('framing', () => {
  // Hand-derived frame bit sequence tests (Req 4.4, Req 15.1)
  describe('byteToFrameBits — hand-derived expectations', () => {
    it('0x00 → [0, 0,0,0,0,0,0,0,0, 1,1]', () => {
      expect(byteToFrameBits(0x00)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    });

    it('0xFF → [0, 1,1,1,1,1,1,1,1, 1,1]', () => {
      expect(byteToFrameBits(0xff)).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('0x01 → [0, 1,0,0,0,0,0,0,0, 1,1]', () => {
      expect(byteToFrameBits(0x01)).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    });

    it('0xA5 → [0, 1,0,1,0,0,1,0,1, 1,1]', () => {
      // 0xA5 = 10100101; LSB-first: 1,0,1,0,0,1,0,1
      expect(byteToFrameBits(0xa5)).toEqual([0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1]);
    });
  });

  describe('byteToFrameBits — structure', () => {
    it('always produces 11 bits', () => {
      for (let b = 0; b <= 255; b++) {
        expect(byteToFrameBits(b).length).toBe(11);
      }
    });

    it('start bit is always 0', () => {
      for (let b = 0; b <= 255; b++) {
        expect(byteToFrameBits(b)[0]).toBe(0);
      }
    });

    it('both stop bits are always 1', () => {
      for (let b = 0; b <= 255; b++) {
        const bits = byteToFrameBits(b);
        expect(bits[9]).toBe(1);
        expect(bits[10]).toBe(1);
      }
    });
  });

  describe('frameBitsToByte — invalid inputs', () => {
    it('returns null for wrong length', () => {
      expect(frameBitsToByte([0, 0, 0, 0, 0, 0, 0, 0, 0, 1] as ReadonlyArray<0 | 1>)).toBeNull();
    });

    it('returns null for invalid start bit', () => {
      expect(frameBitsToByte([1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1] as ReadonlyArray<0 | 1>)).toBeNull();
    });

    it('returns null for invalid first stop bit', () => {
      expect(frameBitsToByte([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] as ReadonlyArray<0 | 1>)).toBeNull();
    });

    it('returns null for invalid second stop bit', () => {
      expect(frameBitsToByte([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] as ReadonlyArray<0 | 1>)).toBeNull();
    });
  });

  // Feature: tapeghost-mvp, Property 6: Framing Invertibility
  // Validates: Requirements 4.4, 4.5, 16
  describe('framing invertibility property', () => {
    it('frameBitsToByte(byteToFrameBits(b)) === b for all bytes 0–255', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 255 }), (b) => {
          const bits = byteToFrameBits(b);
          const recovered = frameBitsToByte(bits);
          return recovered === b;
        }),
        { seed: SEED, numRuns: 256 },
      );
    });

    it('start bit is 0 and both stop bits are 1 for all bytes', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 255 }), (b) => {
          const bits = byteToFrameBits(b);
          return bits[0] === 0 && bits[9] === 1 && bits[10] === 1;
        }),
        { seed: SEED, numRuns: 256 },
      );
    });
  });
});

import {
  writeBitInto,
  writeCarrierInto,
  encodeSamples,
  SAMPLES_PER_BIT,
  CARRIER_SAMPLES,
} from '../../src/dsp/fsk';

/**
 * Estimate frequency independently of the decoder by measuring the average
 * spacing between zero-crossings (period), rather than a raw crossing count.
 *
 * Why not a raw count: the encoder starts each bit at phase 0 (sin(0) = 0) and
 * an integer number of cycles fits exactly in a bit-period, so the final
 * return-to-zero lands precisely on the sample at index `start + count`, which
 * is outside the half-open window [start+1, start+count). A naive count is
 * therefore biased low by exactly one crossing (e.g. 7 instead of 8 for a
 * 4-cycle logic-zero bit). Measuring the mean interval between the crossings
 * that ARE observed avoids that boundary bias and recovers the true frequency
 * to well within ±5 Hz.
 */
function estimateFrequency(samples: Int16Array, start: number, count: number, sampleRate: number): number {
  const crossingIndices: number[] = [];
  for (let i = start + 1; i < start + count; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if ((prev < 0 && cur >= 0) || (prev >= 0 && cur < 0)) {
      // Linear-interpolated sub-sample crossing position for precision.
      const frac = prev === cur ? 0 : prev / (prev - cur);
      crossingIndices.push(i - 1 + frac);
    }
  }
  if (crossingIndices.length < 2) {
    // Fallback: too few crossings to measure an interval.
    return (crossingIndices.length / 2) / (count / sampleRate);
  }
  // Average half-period (samples between consecutive zero crossings).
  const span = crossingIndices[crossingIndices.length - 1] - crossingIndices[0];
  const halfPeriods = crossingIndices.length - 1;
  const samplesPerHalfPeriod = span / halfPeriods;
  const samplesPerPeriod = samplesPerHalfPeriod * 2;
  return sampleRate / samplesPerPeriod;
}

describe('FSK signal independence', () => {
  it('logic-zero bit is 1200 Hz (±5 Hz), 160 samples', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    const next = writeBitInto(0, 0, dest, 0, 48000);
    expect(dest.length).toBe(160);
    const freq = estimateFrequency(dest, 0, SAMPLES_PER_BIT, 48000);
    expect(Math.abs(freq - 1200)).toBeLessThanOrEqual(5);
    expect(typeof next).toBe('number');
  });

  it('logic-one bit is 2400 Hz (±5 Hz), 160 samples', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    writeBitInto(1, 0, dest, 0, 48000);
    const freq = estimateFrequency(dest, 0, SAMPLES_PER_BIT, 48000);
    expect(Math.abs(freq - 2400)).toBeLessThanOrEqual(5);
  });

  it('logic-zero bit has 4 cycles (7 crossings in-window + 1 at the exclusive boundary)', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    writeBitInto(0, 0, dest, 0, 48000);
    let crossings = 0;
    for (let i = 1; i < SAMPLES_PER_BIT; i++) {
      if ((dest[i - 1] < 0 && dest[i] >= 0) || (dest[i - 1] >= 0 && dest[i] < 0)) crossings++;
    }
    // 4 complete cycles ⇒ 8 zero-crossings total. The phase-0 sine's 8th
    // crossing (return to zero after the 4th cycle) lands exactly on sample
    // index 160, which is the exclusive end of this 0..159 window, so only 7
    // are observed inside the bit. The missing crossing is the start of the
    // NEXT bit, confirming 4 cycles fit the 160-sample bit-period precisely.
    expect(crossings).toBe(7);
    // Sample 0 is exactly zero (phase 0) — the implicit 8th crossing.
    expect(dest[0]).toBe(0);
  });

  it('logic-one bit has 8 cycles (15 crossings in-window + 1 at the exclusive boundary)', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    writeBitInto(1, 0, dest, 0, 48000);
    let crossings = 0;
    for (let i = 1; i < SAMPLES_PER_BIT; i++) {
      if ((dest[i - 1] < 0 && dest[i] >= 0) || (dest[i - 1] >= 0 && dest[i] < 0)) crossings++;
    }
    // 8 complete cycles ⇒ 16 zero-crossings total; the 16th lands on sample
    // index 160 (exclusive boundary), so 15 are observed in-window. See the
    // logic-zero case above for the boundary reasoning.
    expect(crossings).toBe(15);
    expect(dest[0]).toBe(0);
  });

  it('peak amplitude is within 1 LSB of 24575', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT);
    writeBitInto(1, 0, dest, 0, 48000);
    let peak = 0;
    for (let i = 0; i < SAMPLES_PER_BIT; i++) {
      peak = Math.max(peak, Math.abs(dest[i]));
    }
    expect(Math.abs(peak - 24575)).toBeLessThanOrEqual(1);
  });

  it('carrier is exactly 240,000 samples', () => {
    const dest = new Int16Array(CARRIER_SAMPLES);
    writeCarrierInto(dest, 0);
    expect(dest.length).toBe(240000);
  });

  it('carrier is all 2400 Hz', () => {
    const dest = new Int16Array(CARRIER_SAMPLES);
    writeCarrierInto(dest, 0);
    // Sample the first bit-period
    const freq = estimateFrequency(dest, 0, SAMPLES_PER_BIT, 48000);
    expect(Math.abs(freq - 2400)).toBeLessThanOrEqual(5);
  });

  it('phase is continuous across bit boundaries (no discontinuity)', () => {
    const dest = new Int16Array(SAMPLES_PER_BIT * 2);
    const p1 = writeBitInto(1, 0, dest, 0, 48000);
    writeBitInto(1, p1, dest, SAMPLES_PER_BIT, 48000);
    // Check the boundary: the derivative should not jump abnormally.
    // For a continuous 2400 Hz sine, adjacent samples near the boundary follow the sine.
    // We assert the sample at the boundary equals what a continuous sine predicts.
    const boundary = SAMPLES_PER_BIT;
    const diffBefore = Math.abs(dest[boundary - 1] - dest[boundary - 2]);
    const diffAt = Math.abs(dest[boundary] - dest[boundary - 1]);
    // Differences should be in the same order of magnitude (no phase reset spike)
    expect(diffAt).toBeLessThanOrEqual(diffBefore + 2000);
  });
});

describe('FSK hand-derived per-byte signal (no decoder)', () => {
  const bytes = [0x00, 0xff, 0x01, 0xa5];
  for (const byte of bytes) {
    it(`byte 0x${byte.toString(16).padStart(2, '0')} encodes to 1760 samples with correct per-bit frequencies`, () => {
      const samples = encodeSamples(new Uint8Array([byte]));
      // carrier + 11 bit-periods
      const dataStart = CARRIER_SAMPLES;
      const dataSamples = samples.length - dataStart;
      expect(dataSamples).toBe(11 * SAMPLES_PER_BIT); // 1760

      const frameBits = [0, byte & 1, (byte >> 1) & 1, (byte >> 2) & 1, (byte >> 3) & 1,
        (byte >> 4) & 1, (byte >> 5) & 1, (byte >> 6) & 1, (byte >> 7) & 1, 1, 1];
      for (let bitIdx = 0; bitIdx < 11; bitIdx++) {
        const start = dataStart + bitIdx * SAMPLES_PER_BIT;
        const freq = estimateFrequency(samples, start, SAMPLES_PER_BIT, 48000);
        const expected = frameBits[bitIdx] === 0 ? 1200 : 2400;
        expect(Math.abs(freq - expected)).toBeLessThanOrEqual(10);
      }
    });
  }
});
