# Testing steering — TapeGhost

## Test framework

Vitest (unit and property-based), fast-check with fixed seeds, Playwright (E2E, Chromium + Firefox). Run Vitest in single-run mode (`vitest run`), not watch mode, for CI and pre-commit gates.

## DSP module testability requirement

The DSP module must run in a plain Node.js process with no browser globals. Verify this by importing and calling codec functions in a Vitest test with no JSDOM or happy-dom environment configured for those test files.

## Test categories and file locations

| Category | Location | Description |
|----------|----------|-------------|
| Signal independence | `tests/unit/fsk.test.ts` | Encoder output verified against hand-derived values; no decoder used |
| Envelope unit | `tests/unit/envelope.test.ts` | Serialization, parsing, CRC KAT, boundary conditions |
| WAV structure | `tests/unit/wav.test.ts` | Header fields, chunk sizes, ffprobe verification (CI only) |
| Decoder unit | `tests/unit/decoder.test.ts` | Carrier acquisition, framing, error categories |
| Property-based | `tests/unit/envelope.test.ts` and separate `tests/unit/codec-audio.test.ts` | Envelope PBT and audio round-trip PBT in separate files |
| Rejection paths | `tests/unit/errors.test.ts` | All 11+ error conditions, no crashes, no false success |
| E2E round-trip | `tests/e2e/round-trip.spec.ts` | Playwright: fresh page session, download, reimport |
| E2E error paths | `tests/e2e/error-paths.spec.ts` | CRC mismatch display, unsupported profile handling |

## Property-based testing rules

- Seed: a numeric literal constant defined in source (not env-var, not random).
- Minimum 100 samples per run for round-trip and envelope properties.
- Include at least 100 short cases (1–16 bytes) and at least 1 explicit 1024-byte case.
- Separate envelope/framing PBT from audio/WAV PBT so expensive audio tests can run independently.

## Signal independence rules

- Verify 1200 Hz and 2400 Hz frequencies explicitly (±5 Hz tolerance), with cycle-count confirmation (4 cycles for 0, 8 cycles for 1).
- Verify carrier duration ≥ 240,000 samples independently of decoder.
- Verify WAV header fields with an independent parser (not the TapeGhost decoder).
- CRC known-answer test: CRC-32/ISO-HDLC of ASCII `123456789` = `0xCBF43926`.
- Verify exact bit sequences for bytes 0x00, 0xFF, 0x01, 0xA5 using hand-derived values.

## Fixture rules

- At least one fixture must be independently authored (not produced by running the TapeGhost encoder).
- Each fixture file must include a provenance comment: derivation method and author (human or tool name).
- Generated fixtures must be labeled as such.
- Include fixtures at both 44,100 Hz and 48,000 Hz.
- Leading-silence variants: 0 s, 1 s, arbitrary offset; phase-zero and non-zero (e.g., π/4) starting phases.

## CRC-mismatch test procedure

1. Serialize a valid TGHO envelope to bytes.
2. Mutate exactly 1 payload byte at a fixed offset; do not change the CRC field.
3. Modulate the mutated envelope bytes into audio via the standard encoder path.
4. Submit the WAV to the decoder; verify CRC mismatch error, no payload returned.
5. Also test directly at the envelope parser level (bypass audio path).
6. Do not use random WAV sample damage; it cannot guarantee a CRC mismatch.

## Unsupported profile tests

Use the single error category `unsupported-wav-profile` with a detail string identifying the mismatched parameter (e.g., `"unsupported sample rate: 22050"`). Test: stereo, non-PCM (format tag ≠ 1), 22,050 Hz, 8-bit depth. Each must produce a distinguishable detail string, not a separate error type.

## E2E requirements

- Round-trip test must open a **fresh browser page session** with no prior state before importing the WAV.
- CRC mismatch E2E test must use envelope-level mutation, not random byte flipping of the WAV.
- Record Chromium and Firefox versions in CI artifacts at test time.

## ffprobe CI verification

`ffprobe` is absent from the local PATH. Planned GitHub Actions CI installs it via:
```
sudo apt-get update && sudo apt-get install -y ffmpeg
```
This is planned and unverified until a workflow file exists and a CI run completes. Mark WAV ffprobe tests as requiring the `ffprobe` binary; skip gracefully if not present in local test runs.

## Performance measurement

Performance targets (2 s encode, 2 s decode, 64 MiB buffer) are goals pending measurement. Instrument codec allocations in tests (not browser memory API). Measure wall-clock from call site, not from inside the worker. A missed target must be reported in `docs/KIRO_USAGE.md`; do not silently change the requirement.
