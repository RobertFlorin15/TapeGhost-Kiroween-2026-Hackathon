/**
 * FSK decoder — carrier acquisition, symbol timing, byte recovery.
 *
 * Pure TypeScript, no browser globals. All functions synchronous.
 * Mirrors the encoder (fsk.ts): 8N2 framing, LSB-first, 1200 Hz = zero,
 * 2400 Hz = one, 300 baud. See DSP correctness steering and design Section 6.
 */

import type { WavData } from './wav';
import type { TghoError } from './errors';
import { parseEnvelope, type TghoKind } from './envelope';

export type SymbolClass = 'one' | 'zero' | 'ambiguous';

export type DecodeSuccess = {
  readonly ok: true;
  readonly kind: TghoKind;
  readonly payloadBytes: Uint8Array;
  readonly filenameBytes: Uint8Array;
  readonly crcVerified: true;
};
export type DecodeFailure = { readonly ok: false; readonly error: TghoError };
export type DecodeResult = DecodeSuccess | DecodeFailure;

export const FREQ_ZERO = 1200;
export const FREQ_ONE = 2400;
export const BAUD = 300;
export const CLASSIFIER_THRESHOLD = 1.5; // proposed, pending measurement
export const CARRIER_MIN_BITS = 900; // 3 seconds × 300 baud, at both sample rates
export const START_BIT_SEARCH_LIMIT = 10_000; // bit-periods
const TWO_PI = 2 * Math.PI;
const TGHO_MAGIC = [0x54, 0x47, 0x48, 0x4f];
const MAX_ENVELOPE_BYTES = 1104; // 12 header + 64 filename + 1024 payload + 4 CRC

/**
 * Classify one bit-period via a quadrature correlator at 1200 Hz and 2400 Hz.
 * Bounds-checked: an out-of-range window returns 'ambiguous'.
 */
export function classifyBitPeriod(
  samples: Int16Array,
  startSample: number,
  samplesPerBit: number,
  sampleRate: number,
): SymbolClass {
  if (startSample < 0 || startSample + samplesPerBit > samples.length) {
    return 'ambiguous';
  }
  const step0 = (TWO_PI * FREQ_ZERO) / sampleRate;
  const step1 = (TWO_PI * FREQ_ONE) / sampleRate;
  let i0 = 0;
  let q0 = 0;
  let i1 = 0;
  let q1 = 0;
  for (let n = 0; n < samplesPerBit; n++) {
    const s = samples[startSample + n];
    i0 += s * Math.cos(n * step0);
    q0 += s * Math.sin(n * step0);
    i1 += s * Math.cos(n * step1);
    q1 += s * Math.sin(n * step1);
  }
  const energy0 = i0 * i0 + q0 * q0;
  const energy1 = i1 * i1 + q1 * q1;
  if (energy1 > energy0 * CLASSIFIER_THRESHOLD) return 'one';
  if (energy0 > energy1 * CLASSIFIER_THRESHOLD) return 'zero';
  return 'ambiguous';
}

/** Samples per bit-period for a given sample rate (160 at 48k, 147 at 44.1k). */
export function samplesPerBitFor(sampleRate: number): number {
  return Math.round(sampleRate / BAUD);
}

/**
 * Coarse carrier scan advancing by samplesPerBit, counting consecutive 'one'
 * classifications. Requires ≥ CARRIER_MIN_BITS consecutive ones.
 * Returns the sample index immediately after the last carrier bit-period, or
 * a no-carrier error.
 */
export function acquireCarrier(
  samples: Int16Array,
  sampleRate: number,
): { coarseCarrierEndSample: number } | TghoError {
  const spb = samplesPerBitFor(sampleRate);
  let consecutiveOnes = 0;
  let runStart = 0;
  for (let start = 0; start + spb <= samples.length; start += spb) {
    const c = classifyBitPeriod(samples, start, spb, sampleRate);
    if (c === 'one') {
      if (consecutiveOnes === 0) runStart = start;
      consecutiveOnes++;
    } else {
      // A run just ended. If it was long enough to be the carrier, the data
      // begins here — report the coarse end as the start of this bit-period.
      // The alignment search refines the exact symbol clock around this point.
      if (consecutiveOnes >= CARRIER_MIN_BITS) {
        return { coarseCarrierEndSample: start };
      }
      consecutiveOnes = 0;
    }
  }
  // Reached end of buffer while still inside a qualifying run: carrier present
  // but no data followed. Report the end of the run so alignment can try (it
  // will fail with sync-failure/truncation, which is the correct outcome).
  if (consecutiveOnes >= CARRIER_MIN_BITS) {
    return { coarseCarrierEndSample: runStart + consecutiveOnes * spb };
  }
  return { kind: 'no-carrier' };
}

/**
 * Decode one 8N2 frame (11 bit-periods) starting at offset.
 * Start bit must be 'zero'; both stop bits must be 'one'; any 'ambiguous'
 * classification is a framing error. Insufficient samples → truncation.
 */
export function frameByte(
  samples: Int16Array,
  offset: number,
  samplesPerBit: number,
  sampleRate: number,
): { byte: number; nextOffset: number } | TghoError {
  if (offset + 11 * samplesPerBit > samples.length) {
    return { kind: 'truncation' };
  }
  const classify = (bitIndex: number): SymbolClass =>
    classifyBitPeriod(samples, offset + bitIndex * samplesPerBit, samplesPerBit, sampleRate);

  const start = classify(0);
  if (start === 'ambiguous') return { kind: 'framing-error' };
  if (start !== 'zero') return { kind: 'framing-error' };

  let byte = 0;
  for (let b = 0; b < 8; b++) {
    const bit = classify(1 + b);
    if (bit === 'ambiguous') return { kind: 'framing-error' };
    if (bit === 'one') byte |= 1 << b;
  }

  const stop1 = classify(9);
  const stop2 = classify(10);
  if (stop1 !== 'one' || stop2 !== 'one') return { kind: 'framing-error' };

  return { byte, nextOffset: offset + 11 * samplesPerBit };
}

/**
 * Symbol-clock alignment. The coarse carrier-end estimate may be up to one
 * bit-period early or late, so we scan every candidate offset in a window of
 * [−spb, +spb) relative to the coarse end. The first offset that decodes the
 * four TGHO magic bytes without a framing error establishes the symbol clock.
 * No candidate succeeds → sync-failure.
 */
export function alignSymbols(
  samples: Int16Array,
  coarseCarrierEndSample: number,
  sampleRate: number,
): { dataBitOffset: number } | TghoError {
  const spb = samplesPerBitFor(sampleRate);
  const searchStart = Math.max(0, coarseCarrierEndSample - spb);
  for (let delta = 0; delta < 2 * spb; delta++) {
    const candidate = searchStart + delta;
    let offset = candidate;
    const magic: number[] = [];
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const r = frameByte(samples, offset, spb, sampleRate);
      if ('kind' in r) {
        ok = false;
        break;
      }
      magic.push(r.byte);
      offset = r.nextOffset;
    }
    if (
      ok &&
      magic[0] === TGHO_MAGIC[0] &&
      magic[1] === TGHO_MAGIC[1] &&
      magic[2] === TGHO_MAGIC[2] &&
      magic[3] === TGHO_MAGIC[3]
    ) {
      return { dataBitOffset: candidate };
    }
  }
  return { kind: 'sync-failure' };
}

/**
 * Full decode: acquire carrier, align symbols, recover envelope bytes, then
 * hand off to parseEnvelope for structural + CRC validation.
 */
export function decodeWav(wavData: WavData): DecodeResult {
  const { samples, sampleRate } = wavData;
  const spb = samplesPerBitFor(sampleRate);

  const carrier = acquireCarrier(samples, sampleRate);
  if ('kind' in carrier) return { ok: false, error: carrier };

  const align = alignSymbols(samples, carrier.coarseCarrierEndSample, sampleRate);
  if ('kind' in align) return { ok: false, error: align };

  const collected: number[] = [];
  let offset = align.dataBitOffset;
  let expectedTotal = -1;
  for (;;) {
    const r = frameByte(samples, offset, spb, sampleRate);
    if ('kind' in r) return { ok: false, error: r };
    collected.push(r.byte);
    offset = r.nextOffset;

    if (expectedTotal < 0 && collected.length >= 12) {
      const fl = collected[6] | (collected[7] << 8);
      const pl =
        (collected[8] | (collected[9] << 8) | (collected[10] << 16) | (collected[11] << 24)) >>> 0;
      if (fl > 64) return { ok: false, error: { kind: 'filename-length-overflow', length: fl } };
      if (pl > 1024) return { ok: false, error: { kind: 'payload-length-overflow', length: pl } };
      expectedTotal = 12 + fl + pl + 4;
    }
    if (expectedTotal >= 0 && collected.length >= expectedTotal) break;
    // Safety bound: never collect more than the maximum envelope size.
    if (collected.length > MAX_ENVELOPE_BYTES) {
      return { ok: false, error: { kind: 'truncation' } };
    }
  }

  const envelopeBytes = Uint8Array.from(collected.slice(0, expectedTotal));
  const parsed = parseEnvelope(envelopeBytes);
  // NOTE: a successful TghoEnvelope also has a `kind` field (0 or 1), so we
  // must NOT use `'kind' in parsed` to detect an error. parseEnvelope returns
  // either a TghoEnvelope (which carries `payloadBytes`) or a TghoError (which
  // never does); `payloadBytes` is the reliable discriminator.
  if (!('payloadBytes' in parsed)) {
    return { ok: false, error: parsed };
  }

  return {
    ok: true,
    kind: parsed.kind,
    payloadBytes: parsed.payloadBytes,
    filenameBytes: parsed.filenameBytes,
    crcVerified: true,
  };
}
