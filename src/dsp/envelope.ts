/**
 * TGHO envelope — serialization and parsing.
 *
 * Frozen wire contract (byte offsets):
 *   0   4   Magic: ASCII "TGHO" (0x54 0x47 0x48 0x4F)
 *   4   1   Version: uint8, value 1
 *   5   1   Kind: uint8, 0=UTF-8 text, 1=binary file
 *   6   2   Filename Length: uint16 LE, 0–64
 *   8   4   Payload Length: uint32 LE, 0–1024
 *   12  FL  Filename bytes (UTF-8)
 *   12+FL PL Payload bytes (raw)
 *   12+FL+PL 4 CRC: uint32 LE, CRC-32/ISO-HDLC over bytes 0..(12+FL+PL-1)
 */

import { crc32 } from './crc32';
import type { TghoError } from './errors';
export type { TghoError } from './errors';
export { formatError } from './errors';

export const TGHO_KIND_TEXT = 0 as const;
export const TGHO_KIND_BINARY = 1 as const;
export type TghoKind = typeof TGHO_KIND_TEXT | typeof TGHO_KIND_BINARY;

export interface TghoEnvelope {
  readonly version: 1;
  readonly kind: TghoKind;
  /** Raw UTF-8 bytes of the filename; must be empty Uint8Array for Kind=0 */
  readonly filenameBytes: Uint8Array;
  /** Raw payload bytes */
  readonly payloadBytes: Uint8Array;
}

const MAGIC = new Uint8Array([0x54, 0x47, 0x48, 0x4f]); // TGHO

/**
 * Serialize a TghoEnvelope to bytes.
 * Validates inputs before allocating; returns a TghoError on invalid input.
 */
export function serializeEnvelope(env: TghoEnvelope): Uint8Array | TghoError {
  // Validate before allocation
  if (env.kind !== TGHO_KIND_TEXT && env.kind !== TGHO_KIND_BINARY) {
    return { kind: 'unknown-kind', value: env.kind };
  }
  if (env.kind === TGHO_KIND_TEXT && env.filenameBytes.length !== 0) {
    return { kind: 'filename-in-text-envelope' };
  }
  if (env.filenameBytes.length > 64) {
    return { kind: 'filename-length-overflow', length: env.filenameBytes.length };
  }
  if (env.payloadBytes.length > 1024) {
    return { kind: 'payload-length-overflow', length: env.payloadBytes.length };
  }

  const fl = env.filenameBytes.length;
  const pl = env.payloadBytes.length;
  const totalSize = 12 + fl + pl + 4;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // Magic at offset 0
  buf.set(MAGIC, 0);
  // Version at offset 4
  buf[4] = 1;
  // Kind at offset 5
  buf[5] = env.kind;
  // Filename Length (uint16 LE) at offset 6
  view.setUint16(6, fl, true);
  // Payload Length (uint32 LE) at offset 8
  view.setUint32(8, pl, true);
  // Filename bytes at offset 12
  if (fl > 0) buf.set(env.filenameBytes, 12);
  // Payload bytes at offset 12+FL
  if (pl > 0) buf.set(env.payloadBytes, 12 + fl);
  // CRC (uint32 LE) at offset 12+FL+PL
  const crcValue = crc32(buf.subarray(0, 12 + fl + pl));
  view.setUint32(12 + fl + pl, crcValue, true);

  return buf;
}

const MAX_FILENAME_LENGTH = 64;
const MAX_PAYLOAD_LENGTH = 1024;

/**
 * Derive a safe suggested download basename from raw filename bytes.
 * Strips path separators, leading dot sequences, null bytes, and control chars;
 * truncates to 64 code points; falls back to 'recovered_file' if empty.
 * This never fails the parse — it only affects the suggested download name.
 */
export function sanitizeFilename(filenameBytes: Uint8Array): string {
  let name: string;
  try {
    name = new TextDecoder('utf-8', { fatal: false }).decode(filenameBytes);
  } catch {
    name = '';
  }
  // Remove path separators
  name = name.replace(/[/\\]/g, '');
  // Remove leading dot sequences (.. etc.)
  name = name.replace(/^\.+/, '');
  // Remove null bytes and control characters (U+0000–U+001F, U+007F)
   
  name = name.replace(/[\u0000-\u001f\u007f]/g, '');
  // Truncate to 64 code points
  name = Array.from(name).slice(0, 64).join('');
  if (name.length === 0) return 'recovered_file';
  return name;
}

/**
 * Parse a TGHO envelope from bytes with full bounds checking.
 * Validation order (first failure returns immediately):
 *   0. minimum length (< 12) → truncation
 *   1. magic  2. version  3. kind  4. FL bound  5. PL bound
 *   6. total length  7. CRC  8. Kind=0 filename check  9. UTF-8 (Kind=0)
 *   (filename sanitization for Kind=1 is applied by the caller via sanitizeFilename)
 */
export function parseEnvelope(bytes: Uint8Array): TghoEnvelope | TghoError {
  // Step 0: minimum header length
  if (bytes.length < 12) return { kind: 'truncation' };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Step 1: magic
  if (bytes[0] !== 0x54 || bytes[1] !== 0x47 || bytes[2] !== 0x48 || bytes[3] !== 0x4f) {
    return { kind: 'magic-mismatch' };
  }
  // Step 2: version
  if (bytes[4] !== 1) return { kind: 'unsupported-version', version: bytes[4] };
  // Step 3: kind
  const kindByte = bytes[5];
  if (kindByte !== 0 && kindByte !== 1) return { kind: 'unknown-kind', value: kindByte };
  // Step 4: filename length bound
  const fl = view.getUint16(6, true);
  if (fl > MAX_FILENAME_LENGTH) return { kind: 'filename-length-overflow', length: fl };
  // Step 5: payload length bound
  const pl = view.getUint32(8, true);
  if (pl > MAX_PAYLOAD_LENGTH) return { kind: 'payload-length-overflow', length: pl };
  // Step 6: total length check
  if (bytes.length < 12 + fl + pl + 4) return { kind: 'truncation' };
  // Step 7: CRC verification
  const storedCrc = view.getUint32(12 + fl + pl, true);
  const computedCrc = crc32(bytes.subarray(0, 12 + fl + pl));
  if (storedCrc !== computedCrc) return { kind: 'crc-mismatch' };
  // Step 8: Kind=0 filename check
  if (kindByte === 0 && fl !== 0) return { kind: 'filename-in-text-envelope' };

  const filenameBytes = bytes.slice(12, 12 + fl);
  const payloadBytes = bytes.slice(12 + fl, 12 + fl + pl);

  // Step 9: UTF-8 validation for Kind=0
  if (kindByte === 0) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes);
    } catch {
      return { kind: 'utf8-encoding-error' };
    }
  }

  return {
    version: 1,
    kind: kindByte as TghoKind,
    filenameBytes,
    payloadBytes,
  };
}
