# Implementation Plan: TapeGhost MVP

## Overview

Five milestones gate the implementation. Each milestone must be fully green before the next begins. The DSP layer (pure TypeScript, no browser globals) is built and independently tested first; the decoder and round-trip gate follow; then the browser layer (worker, playback, UI, E2E); then polish and performance measurement; finally CI, deployment, and submission.

Property-based tests use fast-check with a fixed `const SEED = 42` seed and `numRuns: 100`. Every PBT sub-task carries a comment tag referencing the corresponding design property. Test sub-tasks are marked optional (`*`) and must not be executed by a coding agent unless explicitly invoked.

---

## Tasks

### M1 — Scaffold + Encoder Independent Tests

- [x] 1. Initialise project scaffold
  - Create `package.json` with exact-versioned dependencies: `react`, `react-dom`, `vite`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `playwright`, `@playwright/test`, `eslint`, `prettier`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`
  - Create `tsconfig.json` with `"strict": true`, `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, and path aliases `@dsp/*` → `src/dsp/*`
  - Create `vite.config.ts` with React plugin, worker configuration (`type: 'module'`), and `build.target: 'es2022'`
  - Create `vitest.config.ts` with `environment: 'node'` for `tests/unit/**` and `environment: 'jsdom'` excluded (all DSP tests run in Node)
  - Create `playwright.config.ts` skeleton with Chromium and Firefox projects and `outputDir: 'test-results'`
  - Create `.eslintrc.cjs` with `@typescript-eslint/recommended` and `"no-any": "error"` equivalent via `@typescript-eslint/no-explicit-any`
  - Create `.prettierrc` with project formatting defaults
  - Create directory skeleton: `src/dsp/`, `src/workers/`, `src/audio/`, `src/components/`, `tests/unit/`, `tests/fixtures/independent/`, `tests/fixtures/generated/`, `tests/e2e/`, `docs/submission/`
  - Create empty index files (`src/dsp/index.ts`, `src/App.tsx`, `src/main.tsx`) so TypeScript compilation succeeds
  - Verify: `npm run build` exits 0; `npx tsc --noEmit` exits 0; `npx vitest run` exits 0 on an empty test suite
  - _Requirements: Req 14.4, Req 18.1_

- [x] 2. Implement CRC-32/ISO-HDLC (`src/dsp/crc32.ts`)
  - Build a 256-entry precomputed lookup table using reflected polynomial `0xEDB88320`
  - Implement `crc32(bytes: Uint8Array): number` returning an unsigned 32-bit integer; initial value `0xFFFFFFFF`, final XOR `0xFFFFFFFF`, input and output reflected
  - Export named `crc32` only; no default export; no browser globals
  - [ ]* 2.1 Write KAT unit test in `tests/unit/envelope.test.ts`
    - Assert `crc32(new Uint8Array([0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39]))` equals `0xCBF43926`
    - Test file must import directly from `src/dsp/crc32.ts` with no JSDOM environment
    - _Requirements: Req 3.8, Req 15.4_
  - Verify: KAT test passes; `npx tsc --noEmit` exits 0
  - _Requirements: Req 3.7, Req 3.8, Req 15.4_

- [x] 3. Implement TGHO envelope serializer (`src/dsp/envelope.ts` — serialize side)
  - Define and export all types: `TghoKind`, `TGHO_KIND_TEXT`, `TGHO_KIND_BINARY`, `TghoEnvelope`, `TghoError` discriminated union (all 15 error kinds from design) including `formatError(err: TghoError): string`
  - Implement `serializeEnvelope(env: TghoEnvelope): Uint8Array` following the 10-step build sequence from the design: allocate, write magic at offset 0, version at 4, kind at 5, FL uint16LE at 6, PL uint32LE at 8, filename bytes at 12, payload bytes at 12+FL, CRC uint32LE at 12+FL+PL
  - No browser globals; use `DataView` for multi-byte writes
  - [ ]* 3.1 Write unit tests in `tests/unit/envelope.test.ts` for serializer
    - Test magic bytes, version, kind, Filename Length, Payload Length, CRC field for Kind=0 empty payload, Kind=0 non-empty, Kind=1 with filename
    - Test boundary: FL=0 means no filename bytes in output; PL=0 means no payload bytes
    - _Requirements: Req 3.1–3.9_
  - [ ]* 3.2 Write envelope round-trip PBT in `tests/unit/envelope.test.ts`
    - Tag: `// Feature: tapeghost-mvp, Property 1: Envelope Serialization Round Trip`
    - `const SEED = 42`; `numRuns: 100`; generate arbitrary Kind=0 (payloadBytes 0–1024, empty filename) and Kind=1 (payloadBytes 0–1024, filenameBytes 0–64) envelopes
    - Assert `parseEnvelope(serializeEnvelope(env))` produces an equal envelope (note: `parseEnvelope` will be stubbed until Task 10 — test can be skipped via `it.todo` until then and enabled in M2)
    - _Requirements: Req 16.1, Req 16.2, Req 16.4, Req 16.5_
  - Verify: serializer unit tests pass; PBT stub passes as todo; `npx tsc --noEmit` exits 0
  - _Requirements: Req 3.1–3.9_

- [x] 4. Implement 8N2 framing (`src/dsp/framing.ts`)
  - Implement `byteToFrameBits(byte: number): ReadonlyArray<0 | 1>` returning exactly 11 bits: `[0, b0, b1, b2, b3, b4, b5, b6, b7, 1, 1]` (start bit 0, 8 LSB-first data bits, 2 stop bits 1)
  - Implement `frameBitsToByte(bits: ReadonlyArray<0 | 1>): number | null` returning `null` if `bits[0] !== 0` or `bits[9] !== 1` or `bits[10] !== 1`
  - No browser globals; pure functions with zero allocation per call
  - [ ]* 4.1 Write framing invertibility property test in `tests/unit/fsk.test.ts`
    - Tag: `// Feature: tapeghost-mvp, Property 6: Framing Invertibility`
    - `const SEED = 42`; `numRuns: 256`; for all bytes 0–255 assert `frameBitsToByte(byteToFrameBits(b)) === b`, start bit is 0, both stop bits are 1
    - _Requirements: Req 4.4, Req 4.5, Req 16_
  - [ ]* 4.2 Write hand-derived frame bit sequence tests in `tests/unit/fsk.test.ts`
    - Assert exact bit sequences for 0x00, 0xFF, 0x01, 0xA5 from the requirements specification
    - 0x00: `[0, 0,0,0,0,0,0,0,0, 1,1]`
    - 0xFF: `[0, 1,1,1,1,1,1,1,1, 1,1]`
    - 0x01: `[0, 1,0,0,0,0,0,0,0, 1,1]`
    - 0xA5: `[0, 1,0,1,0,0,1,0,1, 1,1]`
    - _Requirements: Req 4.4, Req 15.1_
  - Verify: all framing tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 4.4, Req 4.5, Req 15.1_

- [x] 5. Implement FSK encoder (`src/dsp/fsk.ts`)
  - Implement `writeBitInto(bit: 0|1, phase: number, dest: Int16Array, offset: number, sampleRate: 48000): number` writing exactly 160 samples of a 1200 Hz (bit=0) or 2400 Hz (bit=1) sine wave into `dest` starting at `offset`; amplitude `Math.round(0.75 * 32767 * Math.sin(currentPhase))` clamped to `[-32767, 32767]`; returns `nextPhase = phase + 160 * phaseStep`; no allocation
  - Maintain phase continuity: `nextPhase` from one call is passed as `phase` of the next; no reset between bits, characters, or carrier-to-data transition
  - Carrier generation helper (used by worker): 1500 calls to `writeBitInto(1, phase, output, writePos, 48000)` starting at `phase = 0`, producing 240,000 samples of 2400 Hz
  - No browser globals; no `new Int16Array` inside `writeBitInto`
  - [ ]* 5.1 Write signal independence tests in `tests/unit/fsk.test.ts`
    - Verify 1200 Hz dominant frequency (±5 Hz) for a logic-zero bit-period: compute dominant frequency from 160 raw samples using zero-crossing or FFT, confirm 4 cycles present
    - Verify 2400 Hz dominant frequency (±5 Hz) for a logic-one bit-period: confirm 8 cycles present
    - Each symbol exactly 160 samples at 48 kHz
    - Carrier exactly 240,000 samples, all at 2400 Hz, starting phase 0 radians
    - Verify amplitude peak is within 1 LSB of 24575
    - _Requirements: Req 4.1–4.3, Req 4.6–4.8, Req 15.2, Req 15.5, Req 15.6_
  - [ ]* 5.2 Write hand-derived per-byte signal tests in `tests/unit/fsk.test.ts`
    - Encode each of 0x00, 0xFF, 0x01, 0xA5 using `byteToFrameBits` + `writeBitInto` into a fresh `Int16Array(1760)`
    - Assert total sample count = 1760 (11 bit-periods × 160 samples)
    - Assert start bit (samples 0–159) is a 1200 Hz sine, each data bit uses correct frequency per the bit value, each stop bit is 2400 Hz
    - No decoder involved; comparison against hand-computed frequency expectations only
    - _Requirements: Req 15.1_
  - Verify: all signal tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 4.1–4.9, Req 15.1, Req 15.2, Req 15.5, Req 15.6_

- [x] 6. Implement WAV builder (`src/dsp/wav.ts` — encode side)
  - Implement `buildWav(samples: Int16Array, sampleRate: 48000): ArrayBuffer` producing a RIFF/PCM16 mono 48 kHz file
  - Write 44-byte standard header: `RIFF`, chunk size `36 + sampleCount*2`, `WAVE`, `fmt ` subchunk (16 bytes: tag=1, channels=1, sampleRate=48000, byteRate=96000, blockAlign=2, bitsPerSample=16), `data` subchunk header (size = `sampleCount*2`), then all sample bytes little-endian
  - No timestamps, no LIST chunks, no metadata, no dither
  - No browser globals; use `DataView` for little-endian writes
  - [ ]* 6.1 Write WAV header unit tests in `tests/unit/wav.test.ts`
    - Parse produced header with an independent reader (not the TapeGhost `parseWav`): verify format tag = `0x0001`, channels = 1, sample rate = 48000, bit depth = 16, byte rate = 96000, block align = 2
    - Verify RIFF chunk size = `36 + sampleCount*2` for several sample counts including 0
    - Verify data subchunk size = `sampleCount*2`
    - _Requirements: Req 5.1–5.4, Req 15.3_
  - [ ]* 6.2 Write ffprobe CI verification in `tests/unit/wav.test.ts`
    - Add `beforeAll` guard following the design's `ffprobeAvailable`/`isCI` pattern: local absent → visible `console.warn` + `describe.skip`; CI absent → `throw`
    - `describeFfprobe` block: encode a minimal valid TGHO payload to WAV, write to a temp file, run `ffprobe -v error -show_streams -print_format json`, assert `codec_name === 'pcm_s16le'`, `channels === 1`, `sample_rate === '48000'`; clean up temp file in `afterAll`
    - _Requirements: Req 5.5, Req 18.2_
  - Verify: header unit tests pass; ffprobe block skips with warning locally; `npx tsc --noEmit` exits 0
  - _Requirements: Req 5.1–5.5, Req 15.3_

- [x] 7. Implement encoder error types and input validation (`src/dsp/errors.ts` + validation in `src/dsp/envelope.ts`)
  - Move or confirm all 15 `TghoError` union members are in `src/dsp/errors.ts` (if not already in `envelope.ts`); ensure a single source of truth
  - Implement `formatError(err: TghoError): string` returning a human-readable string for each kind, including the specific detail for `unsupported-wav-profile` and `oversized-file`
  - Add validation guards to the encoder path (called before any allocation): payload length ≤ 1024; filename length ≤ 64; Kind=0 implies empty filename; Kind value must be 0 or 1
  - [ ]* 7.1 Write rejection path tests in `tests/unit/errors.test.ts`
    - Payload length 1025 → `payload-length-overflow` with correct length value
    - Filename length 65 → `filename-length-overflow` with correct length value
    - Kind=0 with non-empty filename → `filename-in-text-envelope`
    - Kind value 2, 255 → `unknown-kind` with correct value
    - Verify `formatError` returns a non-empty string for every `TghoError` kind
    - Verify no test triggers an unhandled exception
    - _Requirements: Req 1.2, Req 2.2, Req 2.7, Req 8.5, Req 8.6, Req 17_
  - Verify: all rejection tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 1.2, Req 2.2, Req 2.7, Req 8.5, Req 8.6_

- [x] 8. DSP Node.js testability verification
  - Add an explicit test in `tests/unit/envelope.test.ts` (or a dedicated `tests/unit/dsp-node.test.ts`) that imports `crc32`, `serializeEnvelope`, `byteToFrameBits`, `writeBitInto`, `buildWav`, and `formatError` directly and calls each with minimal valid arguments
  - The Vitest config for this file must set `environment: 'node'` (no JSDOM, no happy-dom)
  - Assert no `ReferenceError` for `window`, `document`, `AudioContext`, or `Canvas` during import or execution
  - Verify: test passes; `npx vitest run tests/unit/` exits 0
  - _Requirements: Req 14.4_

- [x] 9. M1 checkpoint — all encoder independent tests green
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx vitest run tests/unit/` and confirm 0 failures
  - Run `npx tsc --noEmit` and confirm 0 errors
  - _Requirements: Req 15, Req 16_

---

### M2 — Decoder + Round-Trip Gate

- [x] 10. Implement WAV parser (`src/dsp/wav.ts` — decode side)
  - Implement `parseWav(buffer: ArrayBuffer): WavData | TghoError`
  - Validation order (first failure returns immediately):
    1. File size ≤ 8 MiB; else `{ kind: 'oversized-file', byteCount: buffer.byteLength }`
    2. Parse RIFF/WAVE: read `RIFF` magic and chunk extent; do NOT assume 44-byte fixed header; skip bounded unknown chunks between `fmt ` and `data`
    3. Verify `fmt ` subchunk found; reject duplicates; `unsupported-wav-profile` with detail for: format tag ≠ 1, channels ≠ 1, bit depth ≠ 16, sample rate ∉ {44100, 48000}
    4. Verify `data` subchunk found and size is even; size 0 is valid (silence)
    5. Verify audio duration ≤ 60 s: `dataSamples / sampleRate ≤ 60`; else `unsupported-wav-profile` with detail `"audio too long: Xs"`
    6. Bounds-check: ensure `dataOffset + dataByteSize ≤ buffer.byteLength` before reading samples
    7. Read all `Int16Array` samples little-endian; return `{ samples, sampleRate }`
  - Use `DataView` for all multi-byte reads; no browser globals
  - [ ]* 10.1 Write WAV parser unit tests in `tests/unit/wav.test.ts`
    - Silence WAV (all zeros): parses successfully; `samples.every(s => s === 0)` and correct sample count
    - Stereo WAV → `unsupported-wav-profile` with detail containing `"2 channels"`
    - Non-PCM (format tag 3) → detail containing `"unsupported format tag: 3"`
    - 22050 Hz → detail containing `"unsupported sample rate: 22050"`
    - 8-bit depth → detail containing `"unsupported bit depth: 8"`
    - Oversized (> 8 MiB) → `oversized-file`
    - Truncated RIFF → `unsupported-wav-profile` or `truncation`
    - Duplicate `fmt ` chunk → error (not silent)
    - Valid 44100 Hz and 48000 Hz WAVs → correct `sampleRate` in result
    - _Requirements: Req 6.2–6.5, Req 6.8, Req 8.1, Req 17.2_
  - Verify: WAV parser tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 6.2–6.5, Req 6.8_

- [x] 11. Implement TGHO envelope parser (`src/dsp/envelope.ts` — parse side)
  - Implement `parseEnvelope(bytes: Uint8Array): TghoEnvelope | TghoError` following the 11-step validation order from the design document (Step 0 + steps 1–10)
  - Step 0: `bytes.length < 12` → `{ kind: 'truncation' }`
  - Steps 1–10 in order: magic → version → kind → FL bound → PL bound → total length check → CRC verify → Kind=0 filename check → UTF-8 validate (Kind=0) → filename sanitize (Kind=1) → return envelope
  - Use `DataView` for multi-byte reads; no browser globals
  - Enable the round-trip PBT stub from Task 3.2 (remove `.todo` annotation)
  - [ ]* 11.1 Write envelope parser unit tests in `tests/unit/envelope.test.ts`
    - Truncated (< 12 bytes): `truncation`
    - Wrong magic: `magic-mismatch`
    - Version 0, 2, 255: `unsupported-version` with correct version value
    - Kind 2, 255: `unknown-kind` with correct value
    - FL = 65: `filename-length-overflow`
    - PL = 1025: `payload-length-overflow`
    - Total byte count too short (FL+PL declared but bytes absent): `truncation`
    - Mutated payload byte (CRC field intact): `crc-mismatch`
    - Kind=0 with FL > 0: `filename-in-text-envelope`
    - Kind=0 with non-UTF-8 payload byte 0xFF: `utf8-encoding-error`
    - Kind=1 with filename containing `/` and `..`: sanitized basename strips separators
    - Empty payload round trip (PL=0, FL=0): parses without error
    - _Requirements: Req 7.1–7.10, Req 17.3–17.7_
  - Verify: all envelope parser tests pass; round-trip PBT enabled and passing; `npx tsc --noEmit` exits 0
  - _Requirements: Req 7.1–7.10_

- [x] 12. Implement FSK decoder (`src/dsp/decoder.ts`)
  - Implement `classifyBitPeriod(samples, startSample, samplesPerBit, sampleRate): SymbolClass` using a quadrature correlator against 1200 Hz and 2400 Hz; bounds check first (`startSample + samplesPerBit > samples.length` → `'ambiguous'`); return `'one'`, `'zero'`, or `'ambiguous'`; threshold T = 1.5 (proposed, pending measurement)
  - Implement `acquireCarrier(samples, sampleRate): { carrierEndSample: number } | TghoError` — coarse scan for ≥ 900 consecutive logic-one bit-periods (48 kHz) or ≥ 827 (132,300 ÷ 160 rounded, 44.1 kHz); `samplesPerBit = Math.round(sampleRate / 300)`; returns `{ carrierEndSample }` or `{ kind: 'no-carrier' }`
  - Implement `alignSymbols(samples, carrierEndSample, sampleRate): { dataBitOffset: number } | TghoError` — scan all `samplesPerBit` candidate offsets after `carrierEndSample`; attempt to decode TGHO magic bytes `[0x54, 0x47, 0x48, 0x4F]` using `frameByte` at each candidate; first success → `{ dataBitOffset }`; none → `{ kind: 'sync-failure' }`; bounds check before every correlation window
  - Implement `frameByte(samples, currentOffset, sampleRate): { byte: number; nextOffset: number } | TghoError` — read start bit, 8 data bits (LSB-first), 2 stop bits; start bit must classify as `'zero'`; each stop bit must classify as `'one'`; any `'ambiguous'` → `{ kind: 'framing-error' }`; logic-zero stop bit → `{ kind: 'framing-error' }`; bounds exhausted → `{ kind: 'truncation' }`
  - Implement `decodeWav(wavData: WavData): DecodeResult` calling all stages in sequence; returns `DecodeSuccess` or `DecodeFailure`
  - No browser globals; all functions pure and synchronous
  - [ ]* 12.1 Write carrier acquisition unit tests in `tests/unit/decoder.test.ts`
    - All-silence samples → `no-carrier`
    - Exactly 900 bit-periods of 2400 Hz (48 kHz) → carrier acquired; `carrierEndSample` is correct
    - 44.1 kHz: ≥ 132,300 samples of 2400 Hz → carrier acquired; assert `carrierMin = 132300` as a named constant
    - Carrier below threshold (< 900 bit-periods at 48 kHz) → `no-carrier`
    - Up to 1 second of silence before carrier → carrier still acquired
    - _Requirements: Req 6.6, Req 8.1, Req 8.2, Req 15.7_
  - [ ]* 12.2 Write symbol alignment tests for all `samplesPerBit` offsets in `tests/unit/decoder.test.ts`
    - At 48 kHz: generate a valid minimal TGHO magic signal; test all 160 candidate offsets (0–159); each offset decodes magic correctly
    - At 44.1 kHz: same check for all 147 candidate offsets (0–146)
    - Invalid magic at all offsets → `sync-failure`
    - _Requirements: Req 15.7, design Finding 2_
  - [ ]* 12.3 Write `frameByte` framing tests in `tests/unit/decoder.test.ts`
    - Logic-zero stop bit → `framing-error`; no partial byte returned
    - `'ambiguous'` symbol in data bits → `framing-error`
    - Truncated sample buffer → `truncation`
    - Valid 8N2 byte framing for 0x00, 0xFF, 0x01, 0xA5 decodes correctly
    - _Requirements: Req 4.4, Req 4.5, Req 8.3_
  - [ ]* 12.4 Write fixture-based decoder tests in `tests/unit/decoder.test.ts`
    - 48 kHz, no leading silence, phase 0: encodes a short payload, decodes, assert byte-for-byte match
    - 48 kHz, exactly 1 second leading silence (48000 zero-valued samples before carrier): same check
    - 44.1 kHz, no leading silence, phase 0: roundtrip via `decodeWav` using a resampled fixture
    - Non-zero starting phase (e.g., π/4): decoder must not depend on initial phase
    - _Requirements: Req 15.7_
  - Verify: all decoder tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 6.2, Req 6.9–6.12, Req 7.1–7.10, Req 8.1–8.4_

- [x] 13. Audio round-trip PBT and independent fixture (`tests/unit/codec-audio.test.ts`)
  - Create `tests/unit/codec-audio.test.ts` with `const SEED = 42` at the top
  - Kind=1 binary PBT (`numRuns: 100`):
    - Tag: `// Feature: tapeghost-mvp, Property 2: Encode/Decode Audio Round Trip — Binary Payloads`
    - Generate arbitrary `Uint8Array` of 0–1024 bytes; filenameBytes 0–64 bytes; run full pipeline via `serializeEnvelope` + carrier + `buildWav` + `decodeWav`; assert `ok === true` and `payloadBytes` is byte-for-byte identical; `crcVerified === true`
    - _Requirements: Req 6.1, Req 16.1_
  - Kind=0 text PBT (`numRuns: 100`):
    - Tag: `// Feature: tapeghost-mvp, Property 3: Encode/Decode Audio Round Trip — Text Payloads`
    - Generate valid UTF-8 strings, encode with `TextEncoder`, assert byte length ≤ 1024, run full pipeline; assert recovery
    - _Requirements: Req 1.1, Req 6.1, Req 16.1_
  - Short payload PBT (`numRuns: 100`):
    - Tag: `// Feature: tapeghost-mvp, Property 4: Short Binary Payload Coverage`
    - Generate 1–16 byte arbitrary `Uint8Array`; assert full round-trip succeeds
    - _Requirements: Req 16.3_
  - Explicit boundary lengths: 0, 1, 255, 256, 1023, 1024 bytes — each as a separate `it` assertion
  - Romanian diacritic "ă" (UTF-8: 0xC4 0x83) and emoji "💾" (UTF-8: 0xF0 0x9F 0x92 0xBE) round-trip assertions
  - Independently authored fixture: create `tests/fixtures/independent/hand-derived-48k.ts` with provenance comment (derivation: hand-computed per BYTE Feb 1976 KCS spec; author: human); fixture encodes a known 3-byte payload; test asserts exact recovered bytes without running the TapeGhost encoder to produce the fixture
  - CRC-mismatch Test A (audio path): serialize valid envelope; copy bytes; mutate `payloadBytes[0]` by XOR with `0x01` while CRC field bytes unchanged; modulate via standard encoder path; run `decodeWav`; assert `{ ok: false, error: { kind: 'crc-mismatch' } }` with no `payloadBytes`
  - CRC-mismatch Test B (parser path): same mutation; call `parseEnvelope(mutatedBytes)` directly; assert `kind === 'crc-mismatch'`
  - _Requirements: Req 17.1_
  - [ ]* 13.1 Add performance instrumentation to `codec-audio.test.ts`
    - Record `performance.now()` before and after full round-trip; log `wallClockMs` to console; assert no individual run exceeds 30 s (test guard, not production target)
    - _Requirements: Req 13.1, Req 13.2, Req 13.5_
  - Verify: all codec-audio tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 6.1, Req 16.1–16.5, Req 17.1_

- [x] 14. Rejection and error path tests (`tests/unit/errors.test.ts` — extended)
  - All-silence WAV (every sample = 0) → `no-carrier`
  - Stereo WAV → `unsupported-wav-profile` with detail containing `"2 channels"`
  - Non-PCM WAV (format tag 3) → `unsupported-wav-profile` with detail containing `"unsupported format tag: 3"`
  - 22050 Hz WAV → `unsupported-wav-profile` with detail containing `"unsupported sample rate: 22050"`
  - 8-bit WAV → `unsupported-wav-profile` with detail containing `"unsupported bit depth: 8"`
  - Valid WAV with truncated envelope (1 byte removed after PL field) → `truncation`
  - Version 0 envelope → `unsupported-version` with `version: 0`
  - Version 2 envelope → `unsupported-version` with `version: 2`
  - Version 255 envelope → `unsupported-version` with `version: 255`
  - PL = 1025 → `payload-length-overflow` with `length: 1025`
  - PL = 1024 (maximum valid) → decodes without error
  - Kind=0 with 0xFF byte payload → `utf8-encoding-error`
  - Each test asserts the application does not throw an unhandled exception
  - Each test asserts no partial payload is returned on error
  - Verify: all 12+ rejection cases pass; `npx vitest run tests/unit/errors.test.ts` exits 0
  - _Requirements: Req 8.1–8.7, Req 17.2–17.7_

- [x] 15. Wire DSP public API (`src/dsp/index.ts`)
  - Re-export all public symbols from `crc32.ts`, `envelope.ts`, `framing.ts`, `fsk.ts`, `wav.ts`, `decoder.ts`, `errors.ts`
  - Verify: `import { crc32, serializeEnvelope, parseEnvelope, buildWav, parseWav, byteToFrameBits, frameBitsToByte, writeBitInto, acquireCarrier, alignSymbols, frameByte, decodeWav, formatError } from '@dsp/index'` compiles without error
  - _Requirements: Req 14.4_

- [x] 16. M2 checkpoint — round-trip gate green
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx vitest run tests/unit/` and confirm 0 failures
  - Confirm CRC-mismatch Tests A and B both pass
  - Confirm all 11 error kinds produce distinct non-empty `formatError` strings
  - Run `npx tsc --noEmit` exits 0

---

### M3 — Worker + Playback + Core UI

- [x] 17. Implement async codec worker (`src/workers/codec.worker.ts`)
  - Implement full message protocol: `WorkerRequest` discriminated union dispatch (`encode`, `decode`, `cancel`)
  - Single-active-operation guard: if a request arrives while another is in progress, post `WorkerBusyResponse` immediately and return
  - Per-request cancellation token: a `cancelled` boolean flag checked at chunk boundaries; when set, post `WorkerCancelledResponse` and return
  - Async scheduler: yield between encoder chunks with `await new Promise(r => setTimeout(r, 0))` every 100 bit-periods (matching the carrier-chunk cadence)
  - Progress reporting: post `WorkerProgressResponse` with `percent` and `stage` string at each chunk yield
  - `internal-error` guard: wrap the entire dispatch in `try/catch`; any unexpected exception → post `WorkerErrorResponse { type: 'error', id, error: { kind: 'internal-error', detail: e.message } }`
  - Transfer `wavBuffer` `ArrayBuffer` on `encode-result` (zero-copy); no transfer of the canonical stored buffer
  - Record `performance.now()` at start and end of worker computation; include `wallClockMs` in result responses
  - [ ]* 17.1 Write worker unit tests in `tests/unit/worker.test.ts`
    - Simulate two simultaneous encode requests; assert second gets `busy` immediately
    - Simulate `cancel` mid-encode; assert `cancelled` arrives; assert no `encode-result` follows
    - Force unexpected exception (mock DSP to throw); assert `internal-error` response with non-empty `detail`
    - Cancellation timing: post cancel, assert `cancelled` within 250 ms (use `performance.now()` on the calling side)
    - _Requirements: Req 13.4, Req 14.1–14.3_
  - Verify: worker unit tests pass; `npx tsc --noEmit` exits 0
  - _Requirements: Req 13.4, Req 14.1–14.3_

- [x] 18. Implement audio playback (`src/audio/playback.ts`)
  - Implement `load(wavBuffer: ArrayBuffer): Promise<void>` — copy the buffer (`wavBuffer.slice(0)`) before calling `AudioContext.decodeAudioData` so the original `ArrayBuffer` remains intact for repeat play and download
  - Implement `play(): void` — create a new `AudioBufferSourceNode` each time; connect to `AudioContext.destination`; start
  - Implement `stop(): void` — stop and disconnect the current source node if playing; handle graceful no-op if not playing
  - `AudioContext` is created on the first call to `play()` (lazy initialization, requires prior user gesture); no automatic creation at module load
  - Expose a `currentState: 'idle' | 'loaded' | 'playing'` observable for UI binding
  - No DSP logic; playback.ts must not import from `src/dsp/`
  - [ ]* 18.1 Write buffer lifecycle E2E tests (`tests/e2e/buffer-lifecycle.spec.ts`)
    - Play WAV → stop → download: assert download link is still functional after play
    - Import WAV → decode → play decoded audio: assert playback starts
    - Repeat play (play twice without re-encode): assert second play starts correctly
    - _Requirements: Req 10.5, Req 10.6, design Finding 6_
  - Verify: `npx tsc --noEmit` exits 0; buffer-lifecycle E2E tests pass on Chromium
  - _Requirements: Req 10.5, Req 10.6_

- [x] 19. Implement React UI — encoding panel (`src/components/CassetteControls.tsx`, `src/App.tsx`)
  - Encoding panel: `<textarea>` for text input with `aria-label`; `<input type="file" accept=".bin,.dat,*/*">` for binary file picker; `<output>` showing UTF-8 byte count updated within 200 ms of last keystroke (use `useDeferredValue` or debounce 200 ms); `<output>` showing estimated duration via formula `5 + (16 + FL + PL) * 11 / 300` rounded to 1 decimal; visible byte count warning and disabled Encode button when byte count > 1024; "Encode" button; download `<a>` with `download="tapeghost.wav"` shown after encode; play/stop button distinct from download
  - All interactive controls have associated `<label>` or `aria-label`
  - Tab order: text input → file picker → encode button → play/stop → download (logical top-to-bottom)
  - Encode button triggers encoding via `postMessage` to codec worker; no automatic encoding on input change
  - No payload or WAV data transmitted to any server
  - `role="status"` region for in-progress messages (`aria-live="polite"`)
  - [ ]* 19.1 Add ARIA and accessibility attributes
    - Focus indicators: 2 CSS px outline, 3:1 contrast ratio against adjacent background
    - `prefers-reduced-motion: reduce` suppresses all CSS transitions/animations
    - Minimum usable width 360 px: no horizontal scroll at 360 px for all panel elements
    - _Requirements: Req 12.1–12.10_
  - Verify: `npm run build` exits 0; manual check: tab through encoding panel, activate encode via keyboard
  - _Requirements: Req 9.1–9.8, Req 12.1–12.10_

- [x] 20. Implement React UI — decoding panel (`src/components/StatusPanel.tsx`)
  - Decoding panel: `<input type="file" accept=".wav">` for WAV import; file type guard (reject non-.wav with error message before decoding begins); `<progress>` element updated from worker progress messages; status display using `role="status"` (success, `aria-live="polite"`) and `role="alert"` (error, `aria-live="assertive"`); recovered text display (no HTML interpretation); binary file download button with sanitized filename; play/stop button; "Clear" button that resets all fields and messages
  - Distinguish `crc-mismatch` from `framing-error` in status message text
  - No partial payload shown on any error
  - CRC verification status displayed alongside recovered payload on success
  - [ ]* 20.1 Add keyboard operability for decoding flow
    - File import, clear, play/stop all reachable and activatable via Tab + Enter/Space
    - No focusable element skipped in decoding panel
    - _Requirements: Req 12.3, Req 12.4_
  - Verify: `npm run build` exits 0; manual check: import WAV, decode, verify status; trigger CRC error, verify alert role fires
  - _Requirements: Req 10.1–10.7, Req 8.6, Req 8.7, Req 12.1–12.8_

- [ ] 21. Implement waveform and bit inspector (`src/components/WaveformDisplay.tsx`, `src/components/BitInspector.tsx`)
  - Canvas waveform: render amplitude vs time for full encoded audio duration; horizontal axis = time, vertical axis = amplitude
  - Canvas drag selection: click-and-drag to set start/end sample range; display bit values and tone labels (0 = 1200 Hz, 1 = 2400 Hz) for each bit whose time range falls within the selection
  - Keyboard numeric region selector: pair of labeled `<input type="number">` for start and end positions; produces identical bit-inspection output to canvas drag for the same positions
  - No-selection state: show prompt text "Select a waveform region to inspect bits"
  - Text alternative for waveform: `<p aria-label="...">` or visually hidden element stating encoding scheme, total bit count, and frequency assignment per bit value
  - `prefers-reduced-motion`: suppress animated transitions in waveform rendering and updates
  - `BitInspector` displays a table of bit index, bit value, frequency label; table has `<th>` headers
  - [ ]* 21.1 Write waveform keyboard interaction test
    - E2E: set numeric inputs to a known start/end range; assert bit table shows expected entries for that range
    - _Requirements: Req 11.1–11.6_
  - Verify: `npm run build` exits 0; manual check: canvas drag shows bits; keyboard inputs show same bits for same range
  - _Requirements: Req 11.1–11.6, Req 12.9_

- [x] 22. E2E round-trip test (`tests/e2e/round-trip.spec.ts`)
  - Playwright test: open app in fresh browser page (no prior state, no `storageState`); type a text payload of ≤ 256 UTF-8 bytes; click "Encode"; wait for download link; download WAV; open a new page (fresh `context.newPage()` after `browser.newContext()`); import downloaded WAV; wait for decode result; assert displayed text is byte-for-byte identical to encoded input
  - Run on both Chromium and Firefox projects
  - Record browser name and version to `test-results/browser-versions.json` using Playwright's `browserVersion` and `browserName`
  - [ ]* 22.1 Extend round-trip test for binary payload
    - Upload a small binary file (< 64 bytes); encode; download; fresh session import; assert binary download offered; assert no error status
    - _Requirements: Req 18.3a_
  - Verify: `npx playwright test tests/e2e/round-trip.spec.ts` passes on Chromium and Firefox
  - _Requirements: Req 18.3_

- [x] 23. E2E error path tests (`tests/e2e/error-paths.spec.ts`)
  - CRC mismatch E2E: encode a payload to WAV; apply envelope-level mutation (serialize envelope bytes, mutate `payloadBytes[0]`, re-modulate via worker); import the mutated WAV; assert UI displays a status message containing "CRC mismatch" (not just any error)
  - Unsupported profile E2E: construct a minimal stereo WAV file; import it; assert UI displays an error message containing "stereo" or "channels"
  - Silence E2E: import an all-zeros WAV; assert UI displays "no carrier" or equivalent
  - All assertions check `role="alert"` region content, not element existence only
  - Verify: `npx playwright test tests/e2e/error-paths.spec.ts` passes on Chromium
  - _Requirements: Req 18.3b_

- [x] 24. M3 checkpoint — browser app working end-to-end
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx vitest run` and confirm 0 failures
  - Run `npx playwright test` and confirm 0 failures on Chromium
  - Run `npm run build` exits 0
  - Run `npx tsc --noEmit` exits 0

---

### M4 — Polish, Performance, Accessibility

- [x] 25. Measure and record performance on reference device
  - Run encode benchmark on reference device (Lenovo LOQ 83SC, Intel i5-13450HX, Ubuntu 26.04, Chrome 155): measure wall-clock from `postMessage` to `encode-result`; record actual browser version and conditions
  - Run decode benchmark on same device: measure wall-clock from `postMessage` to `decode-result`
  - Record both worker-internal `wallClockMs` and end-to-end caller measurements
  - Append results to `docs/KIRO_USAGE.md` with device model, OS, browser version, payload size (1024 bytes), and measured ms
  - If encode > 2 s: record exceedance and measured value in `docs/KIRO_USAGE.md`; do NOT silently relax the target; a recorded design decision is required before target value may change
  - If decode > 2 s: same as above
  - [ ]* 25.1 Verify codec buffer budget in unit test
    - Instrument `codec-audio.test.ts`: count `Int16Array` and `ArrayBuffer` allocations inside the encode path; assert total ≤ 64 MiB (67,108,864 bytes) for 1024-byte payload
    - _Requirements: Req 13.3_
  - Verify: benchmark results appear in `docs/KIRO_USAGE.md`; no silent target relaxation
  - _Requirements: Req 13.1, Req 13.2, Req 13.5_

- [x] 26. Worker cancellation E2E (`tests/e2e/worker-cancellation.spec.ts`)
  - Playwright test: start encoding a 1024-byte payload; after receiving at least one `progress` message, post `cancel`; assert a `cancelled` response arrives; assert no `encode-result` response follows within 1 s; run on Chromium
  - Also assert cancel arrives within 250 ms of the cancel post (caller-side timestamp)
  - Verify: `npx playwright test tests/e2e/worker-cancellation.spec.ts` passes on Chromium
  - _Requirements: Req 13.4, Req 14.3_

- [x] 27. Accessibility manual check and fixes
  - Perform keyboard-only walkthrough: encode a text payload → play audio → stop → download WAV → clear → import WAV → decode → verify result → play decoded audio → clear
  - Verify no step requires a mouse or touch gesture
  - Verify no step requires hearing (all status conveyed by text)
  - Verify no step requires color vision (all status conveyed by text label or icon with alt text)
  - Fix any focusable element that cannot be reached via Tab or activated via Enter/Space
  - Verify focus indicators are visible and meet 3:1 contrast at 2 px minimum outline
  - Verify layout at 360 px viewport width: no horizontal scroll for any essential control
  - Verify `prefers-reduced-motion: reduce` suppresses all animations (test in browser DevTools)
  - Record completion and any outstanding issues in `docs/KIRO_USAGE.md`
  - Verify: manual checklist completed; `npm run build` exits 0
  - _Requirements: Req 12.1–12.10_

- [x] 28. M4 checkpoint — performance recorded, accessibility checked
  - Ensure all tests pass, ask the user if questions arise.
  - Confirm `docs/KIRO_USAGE.md` contains benchmark results
  - Run `npx playwright test` confirms 0 failures on Chromium and Firefox

---

### M5 — Release (CI, Deployment, Submission)

- [ ] 29. GitHub Actions CI workflow (`.github/workflows/ci.yml`)
  - Runner: `ubuntu-24.04`
  - Steps in order:
    1. `actions/checkout@v4`
    2. `actions/setup-node@v4` with Node version matching `engines.node` in `package.json`
    3. `npm ci`
    4. `sudo apt-get update && sudo apt-get install -y ffmpeg`
    5. `ffprobe -version` (fail CI if absent)
    6. `npx tsc --noEmit`
    7. `npx eslint src/ tests/`
    8. `npx vitest run`
    9. `npx playwright install --with-deps chromium firefox`
    10. `npx playwright test`
    11. Upload `test-results/` as CI artifact (includes `browser-versions.json`)
  - [ ]* 29.1 Record CI browser versions
    - Verify `test-results/browser-versions.json` artifact is produced and contains `chromium` and `firefox` version strings
    - _Requirements: Req 18.4_
  - Verify: CI workflow file exists at `.github/workflows/ci.yml`; at least one green run recorded; URL of green run noted in `docs/KIRO_USAGE.md`
  - _Requirements: Req 18.1, Req 18.2, Req 18.4_

- [ ] 30. Static deployment (Cloudflare Pages or equivalent)
  - Ensure `vite.config.ts` sets `build.outDir: 'dist'` and all asset paths are relative (no absolute paths)
  - Run `npm run build` and verify `dist/` contains at least one `.html` and at least one `.js` file
  - Deploy to Cloudflare Pages (or equivalent static host): connect to GitHub repo, build command `npm run build`, output directory `dist`
  - Record the public application URL in `docs/KIRO_USAGE.md` and in the submission checklist
  - Verify: `npm run build` exits 0; URL is publicly accessible and app loads
  - _Requirements: Req 18.1, Req 18.5, Req 18.6_

- [ ] 31. README, LICENSE, and submission materials
  - Write `LICENSE` with full MIT license text (project name: TapeGhost, copyright year: 2026)
  - Write `README.md` with: project description, install instructions (`npm install`), run instructions (`npm run dev`), test instructions (`npx vitest run`, `npx playwright test`), link to live URL, link to demo video
  - Write `docs/submission/pitch.md`: 250-word pitch describing TapeGhost, its educational value, and how it was built with Kiro
  - Write `docs/submission/demo-script.md`: step-by-step script for the ≤3 min demo video
  - Write `docs/submission/checklist.md`: Kiroween submission checklist (GitHub URL, live URL, YouTube URL, `.kiro/` tracked, license, open-source, Kiro usage evidence)
  - Verify: `git log --oneline` shows meaningful commits with `.kiro/` tracked; `git ls-files .kiro/` lists spec and steering files
  - _Requirements: Req 18.5_

- [ ] 32. Demo video and Devpost submission
  - Record YouTube demo (unlisted or public) ≤ 3 minutes covering: type a message → Encode → Play → Export WAV → open fresh tab → Import WAV → Decode → display recovered message with CRC OK → show CRC mismatch error on corrupted WAV → demonstrate at least one Kiro artifact (spec, steering, or task panel)
  - Submit on Devpost before 2026-12-04 14:00 PST (equivalent to 2026-12-05 00:00 Bucharest time)
  - Record YouTube URL and Devpost submission URL in `docs/submission/checklist.md` and `docs/KIRO_USAGE.md`
  - Verify: YouTube URL public; Devpost submission shows all required fields complete
  - _Requirements: Req 18.5 (Kiroween submission)_

- [ ] 33. M5 checkpoint — submission complete
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npx vitest run` exits 0
  - Run `npx playwright test` exits 0 on Chromium and Firefox
  - Run `npm run build` exits 0
  - Confirm all URLs (live app, YouTube, Devpost) are recorded in `docs/KIRO_USAGE.md`

---

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for faster MVP progress; all top-level tasks are mandatory.
- Each task references specific requirements for traceability; requirement numbers follow the format `Req N.M`.
- Property-based tests (tagged with a design property number) use fast-check with `const SEED = 42` and `numRuns: 100`; they run in Node.js environment via Vitest.
- `ffprobe` is required in CI (`tests/unit/wav.test.ts`); absent locally → visible `console.warn` + `describe.skip`; absent in CI (`process.env.CI !== undefined`) → `throw` in `beforeAll`.
- The M2 round-trip gate must be green before any decorative UI work begins (product steering).
- Performance targets (2 s encode, 2 s decode, 64 MiB buffer) are goals pending measurement; exceedances must be reported in `docs/KIRO_USAGE.md` and must not be silently relaxed.
- The DSP module (`src/dsp/`) must have zero imports from React, the DOM, `window`, `document`, `AudioContext`, or any browser global; this is verified by Task 8.
- The independently authored fixture in `tests/fixtures/independent/` must carry a provenance comment: derivation method, author name, ISO 8601 date, and notes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "4"] },
    { "id": 2, "tasks": ["2.1", "3", "4.1", "4.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "5"] },
    { "id": 4, "tasks": ["5.1", "5.2", "6"] },
    { "id": 5, "tasks": ["6.1", "6.2", "7"] },
    { "id": 6, "tasks": ["7.1", "8"] },
    { "id": 7, "tasks": ["10", "15"] },
    { "id": 8, "tasks": ["10.1", "11"] },
    { "id": 9, "tasks": ["11.1", "12"] },
    { "id": 10, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 11, "tasks": ["13"] },
    { "id": 12, "tasks": ["13.1", "14"] },
    { "id": 13, "tasks": ["17"] },
    { "id": 14, "tasks": ["17.1", "18"] },
    { "id": 15, "tasks": ["18.1", "19"] },
    { "id": 16, "tasks": ["19.1", "20"] },
    { "id": 17, "tasks": ["20.1", "21"] },
    { "id": 18, "tasks": ["21.1", "22", "23"] },
    { "id": 19, "tasks": ["22.1"] },
    { "id": 20, "tasks": ["25"] },
    { "id": 21, "tasks": ["25.1", "26", "27"] },
    { "id": 22, "tasks": ["29"] },
    { "id": 23, "tasks": ["29.1", "30", "31"] },
    { "id": 24, "tasks": ["32"] }
  ]
}
```
