/**
 * Public DSP API barrel.
 *
 * Explicit named re-exports grouped by module. `export *` is deliberately
 * avoided because fsk.ts and decoder.ts both export FREQ_ZERO / FREQ_ONE;
 * those two constants are re-exported once, from fsk.ts (the canonical
 * encoder constants).
 */

// crc32
export { crc32 } from './crc32';

// errors
export { isTghoError, formatError } from './errors';
export type { TghoError } from './errors';

// envelope
export {
  TGHO_KIND_TEXT,
  TGHO_KIND_BINARY,
  serializeEnvelope,
  parseEnvelope,
  sanitizeFilename,
} from './envelope';
export type { TghoKind, TghoEnvelope } from './envelope';

// framing
export { byteToFrameBits, frameBitsToByte } from './framing';

// fsk (canonical source for FREQ_ZERO / FREQ_ONE)
export {
  writeBitInto,
  writeCarrierInto,
  encodeSamples,
  SAMPLE_RATE,
  SAMPLES_PER_BIT,
  CARRIER_SAMPLES,
  FREQ_ZERO,
  FREQ_ONE,
  AMPLITUDE,
} from './fsk';

// wav
export { buildWav, parseWav } from './wav';
export type { WavData } from './wav';

// decoder (FREQ_ZERO / FREQ_ONE intentionally omitted — exported from fsk)
export {
  classifyBitPeriod,
  samplesPerBitFor,
  acquireCarrier,
  frameByte,
  alignSymbols,
  decodeWav,
  BAUD,
  CLASSIFIER_THRESHOLD,
  CARRIER_MIN_BITS,
  START_BIT_SEARCH_LIMIT,
} from './decoder';
export type { SymbolClass, DecodeSuccess, DecodeFailure, DecodeResult } from './decoder';
