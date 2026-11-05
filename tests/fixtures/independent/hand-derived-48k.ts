/**
 * Fixture provenance:
 *   Derivation: Hand-specified TGHO envelope field values per the frozen wire
 *               contract in .kiro/steering/dsp-correctness.md. The expected
 *               payload bytes and envelope structure were written by a human,
 *               NOT produced by inspecting TapeGhost encoder output.
 *   Author:     TapeGhost maintainer (human), via Kiro task execution
 *   Date:       2026-10-31
 *   Notes:      Kind=1 binary, filename "ok", payload [0x54,0x47,0x00] ("TG\0").
 *               The CRC is computed by the module under test at encode time;
 *               the test asserts the DECODER recovers exactly these payload
 *               bytes, which validates encoder+decoder against a human-authored
 *               expectation rather than a self-referential golden sample.
 */

export const HAND_DERIVED_KIND = 1 as const;
export const HAND_DERIVED_FILENAME = new Uint8Array([0x6f, 0x6b]); // "ok"
export const HAND_DERIVED_PAYLOAD = new Uint8Array([0x54, 0x47, 0x00]); // "TG\0"
