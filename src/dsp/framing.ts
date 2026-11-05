/**
 * 8N2 character framing for KCS-derived FSK.
 *
 * Each character is transmitted as 11 bit-periods:
 *   [start=0, b0, b1, b2, b3, b4, b5, b6, b7, stop=1, stop=1]
 * Bit order is LSB-first: b0 = bit 0 (LSB), b7 = bit 7 (MSB).
 */

/**
 * Convert a byte value (0–255) to an 11-element bit array in 8N2 framing order.
 * Index 0 is the start bit (always 0).
 * Indices 1–8 are data bits, LSB-first.
 * Indices 9–10 are stop bits (always 1).
 */
export function byteToFrameBits(byte: number): ReadonlyArray<0 | 1> {
  const bits: Array<0 | 1> = [0]; // start bit
  for (let i = 0; i < 8; i++) {
    bits.push(((byte >> i) & 1) as 0 | 1);
  }
  bits.push(1, 1); // two stop bits
  return bits;
}

/**
 * Convert an 11-element bit array back to a byte value.
 * Returns null if:
 *   - bits.length !== 11
 *   - bits[0] !== 0 (invalid start bit)
 *   - bits[9] !== 1 (invalid stop bit 1)
 *   - bits[10] !== 1 (invalid stop bit 2)
 */
export function frameBitsToByte(bits: ReadonlyArray<0 | 1>): number | null {
  if (bits.length !== 11) return null;
  if (bits[0] !== 0) return null;
  if (bits[9] !== 1) return null;
  if (bits[10] !== 1) return null;
  let byte = 0;
  for (let i = 0; i < 8; i++) {
    byte |= bits[i + 1] << i;
  }
  return byte;
}
