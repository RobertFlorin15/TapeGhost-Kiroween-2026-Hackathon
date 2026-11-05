/**
 * FSK sine wave generation (encoder side).
 *
 * Logic 0: 1200 Hz, 4 cycles per bit-period, 160 samples at 48 kHz.
 * Logic 1: 2400 Hz, 8 cycles per bit-period, 160 samples at 48 kHz.
 * Amplitude: 0.75 × 32767 ≈ 24575 peak, signed 16-bit.
 * Phase is continuous across all calls (no reset between bits/characters).
 */

import { byteToFrameBits } from './framing';

export const SAMPLE_RATE = 48000 as const;
export const SAMPLES_PER_BIT = 160 as const;
export const CARRIER_SAMPLES = 240000 as const; // exactly 5 seconds
export const FREQ_ZERO = 1200 as const;
export const FREQ_ONE = 2400 as const;
export const AMPLITUDE = 0.75 * 32767; // ≈ 24575.25

const TWO_PI = 2 * Math.PI;

/**
 * Write exactly SAMPLES_PER_BIT (160) samples of a single FSK bit into dest
 * starting at offset. Returns the next phase (radians) for phase continuity.
 *
 * No allocation: writes directly into the caller-provided dest buffer.
 */
export function writeBitInto(
  bit: 0 | 1,
  phase: number,
  dest: Int16Array,
  offset: number,
  sampleRate: 48000,
): number {
  const freq = bit === 0 ? FREQ_ZERO : FREQ_ONE;
  const phaseStep = (TWO_PI * freq) / sampleRate;
  for (let i = 0; i < SAMPLES_PER_BIT; i++) {
    const currentPhase = phase + i * phaseStep;
    let sample = Math.round(AMPLITUDE * Math.sin(currentPhase));
    if (sample > 32767) sample = 32767;
    else if (sample < -32767) sample = -32767;
    dest[offset + i] = sample;
  }
  // Advance phase by a full bit-period; wrap modulo 2π for numerical stability.
  let nextPhase = phase + SAMPLES_PER_BIT * phaseStep;
  nextPhase = nextPhase % TWO_PI;
  return nextPhase;
}

/**
 * Write CARRIER_SAMPLES (240,000) samples of continuous 2400 Hz carrier into
 * dest starting at offset. Returns the next phase for phase continuity.
 */
export function writeCarrierInto(dest: Int16Array, offset: number): number {
  let phase = 0;
  let writePos = offset;
  const carrierBits = CARRIER_SAMPLES / SAMPLES_PER_BIT; // 1500
  for (let i = 0; i < carrierBits; i++) {
    phase = writeBitInto(1, phase, dest, writePos, SAMPLE_RATE);
    writePos += SAMPLES_PER_BIT;
  }
  return phase;
}

/**
 * Encode a complete envelope byte array into an Int16Array of PCM samples:
 * carrier (240,000 samples) followed by 11 bit-periods per byte (8N2 framing).
 * Returns the sample buffer. Phase is continuous throughout.
 */
export function encodeSamples(envelopeBytes: Uint8Array): Int16Array {
  const totalSamples = CARRIER_SAMPLES + envelopeBytes.length * 11 * SAMPLES_PER_BIT;
  const out = new Int16Array(totalSamples);
  let phase = writeCarrierInto(out, 0);
  let writePos = CARRIER_SAMPLES;
  for (let b = 0; b < envelopeBytes.length; b++) {
    const frameBits = byteToFrameBits(envelopeBytes[b]);
    for (const bit of frameBits) {
      phase = writeBitInto(bit, phase, out, writePos, SAMPLE_RATE);
      writePos += SAMPLES_PER_BIT;
    }
  }
  return out;
}
