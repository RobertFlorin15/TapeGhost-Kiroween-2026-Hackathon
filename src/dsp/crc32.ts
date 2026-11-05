// CRC-32/ISO-HDLC implementation — see Task 2
//
// Parameters:
//   polynomial      0x04C11DB7 (reflected: 0xEDB88320)
//   initial value   0xFFFFFFFF
//   input reflected yes
//   output reflected yes
//   final XOR       0xFFFFFFFF
//
// Known-answer test: CRC-32/ISO-HDLC of ASCII "123456789" = 0xCBF43926.
//
// No browser globals, no imports from other modules, no default export.

const REFLECTED_POLYNOMIAL = 0xedb88320;

// 256-entry precomputed lookup table built once at module load using the
// reflected polynomial (standard table-driven CRC-32/ISO-HDLC).
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? REFLECTED_POLYNOMIAL ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * Compute CRC-32/ISO-HDLC over the given bytes.
 *
 * @param bytes input bytes
 * @returns unsigned 32-bit CRC value
 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
