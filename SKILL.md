---
name: tapeghost
description: Plan, review, and track TapeGhost, a browser-based cassette-data revival project for Kiroween 2026. Use for TapeGhost architecture, DSP validation, Kiro handoffs, milestone reviews, and progress updates.
---

# TapeGhost project guide and progress

Tagline: **Bring forgotten data back to life.**

## Purpose and collaboration

Build a small, technically defensible browser application that converts text or small binary files into FSK audio, exports and plays WAV files, and recovers the original bytes with integrity checking. Target Kiroween 2026's Resurrection category and, subject to eligibility, Best Student Project: Resurrection.

Explain engineering decisions to the owner in Romanian. Write code, documentation, commits, and submission materials in English. The owner is a first-year engineering student familiar with programming but new to DSP. Keep explanations concise and make routine decisions autonomously.

Kiro owns the primary implementation, native specs, steering, and hooks. This assistant researches, plans, reviews, and prepares executable handoffs. Do not replace substantial Kiro implementation with work by another agent without an explicit change to that workflow. If Kiro cannot be invoked, provide an exact prompt and expected verification rather than claiming execution.

This root file is a project handoff document with skill metadata. It has not been installed in a global skill directory; automatic discovery is not assumed. Ask Kiro explicitly to read it. It does not replace `.kiro/steering/`.

## Read when needed

- [Project plan](docs/PROJECT_PLAN.md): engineering baseline, acceptance criteria, architecture, milestones, historical sources, and competition checks. Read before changing scope or reviewing implementation.
- [First Kiro prompt](docs/KIRO_FIRST_PROMPT.md): copy-paste handoff for the initial native spec and repository preparation. Use until that milestone is completed; thereafter follow the actual Kiro task list.
- [Requirements review](docs/KIRO_REQUIREMENTS_REVIEW.md): current findings and the exact revision prompt; use before approving the initial requirements.
- [Design review](docs/KIRO_DESIGN_REVIEW.md): current blocking findings and the exact Kiro revision prompt; read before approving design or creating implementation tasks.
- Read `.kiro/specs/tapeghost-mvp/` for the implementation contract. Requirements, initial design, and `.config.kiro` now exist; tasks remain pending. Six steering files and `docs/KIRO_USAGE.md` also exist.

## Engineering invariants

- Prove the complete encode/decode round trip before decorative UI or optional audio effects.
- Keep DSP and binary parsing independent of React, the DOM, and browser playback state.
- Treat the proposed format in the project plan as a design baseline requiring the owner's initial architecture review, not an already implemented standard.
- Distinguish historical modulation/framing from TapeGhost's modern envelope, file metadata, and CRC. Do not claim compatibility with arbitrary vintage tapes or physical cassette recordings.
- Bound input sizes, duration, chunk traversal, allocations, and decoded lengths before processing. Keep bytes intact; decode UTF-8 only for text payloads.
- Test historical signal properties independently of round-trip tests. Encoder and decoder agreement can conceal shared mistakes.
- A CRC detects accidental corruption; it does not correct errors, encrypt data, or establish authenticity.
- Do not mark a feature complete without a reproducible check. Record failures and limitations as well as successes.
- Keep `.kiro/` at repository root and tracked. Do not store student evidence, credentials, or private chat exports in the public repository.

## Progress maintenance

After a meaningful milestone, update the snapshot below with the date, completed features, verification commands and results, next steps, blockers, risks, required owner action, and estimated owner effort. Distinguish planned, implemented, tested, and externally published states.

When recording Kiro work, include the Kiro version/surface, spec task, affected files or commit, actual command/result, hook trigger evidence if applicable, and any human correction. Attribute this assistant's planning separately. Never infer hook execution from the presence of a hook file, or Kiro authorship from a `.kiro/` path.

After a major milestone, explain in Romanian: three technical takeaways, one concrete function/test/design to inspect, and an optional 10–15 minute exercise. Exercises must not block development.

## Verified progress — 2026-10-30, Europe/Bucharest

Stage: **M0 requirements revised and under owner review; design not yet started.**

Completed in this Kiro session (2026-10-30):

- Kiro initialized the native Feature Spec for `tapeghost-mvp` (requirements-first workflow) and created `.kiro/specs/tapeghost-mvp/.config.kiro`.
- Kiro generated `.kiro/specs/tapeghost-mvp/requirements.md` with 18 requirements covering encoding, decoding, TGHO envelope, FSK signal, WAV format, UI/UX, accessibility, performance, and testing. File passed `validate_spec_format` with no errors.
- Kiro applied all 8 review findings from `docs/KIRO_REQUIREMENTS_REVIEW.md`, producing the revised requirements.md. Revised file passed `validate_spec_format` with no errors.
- Kiro created `docs/KIRO_USAGE.md` recording only observed actions.

Key decisions frozen in requirements:

- TGHO envelope: Magic `TGHO`, Version 1, Kind (0=text/1=binary), Filename Length uint16-LE, Payload Length uint32-LE, Filename UTF-8 bytes, Payload bytes, CRC-32/ISO-HDLC uint32-LE.
- Encoder carrier: exactly 5 seconds (240,000 samples at 48 kHz). Decoder minimum: ≥3 seconds.
- Duration estimator: `5 + (16 + filenameUtf8Bytes + payloadBytes) × 11 / 300` seconds.
- FSK: 1200 Hz (4 cycles = logic zero), 2400 Hz (8 cycles = logic one), 160 samples/bit at 48 kHz, 8N2, LSB-first.
- UTF-8 filenames up to 64 bytes stored raw in envelope; sanitization affects only suggested download basename.
- Performance targets are goals pending measurement on a recorded device; changes require a recorded design decision.
- CRC-mismatch test: envelope-level mutation + audio path (not random WAV sample damage).
- Strict framing: any stop-bit violation is an immediate error with no partial payload returned.
- Unsupported WAV profiles: single `unsupported-wav-profile` error category with detail string.

Verification:

- `.kiro/specs/tapeghost-mvp/requirements.md` exists and passes `validate_spec_format` with no issues.
- `.kiro/specs/tapeghost-mvp/.config.kiro` exists with `workflowType: requirements-first`.
- `docs/KIRO_USAGE.md` created with honest session log.
- No application source, tests, build, hook execution, or Kiro task execution has occurred.
- No commit has been made; no remote publication.

Next: owner reviews revised requirements. After approval, Kiro produces `design.md` with exact wire contract, decoder synchronization, error model, worker protocol, and validation strategy. Then `tasks.md` with M1–M5 gates. Before M1 implementation: create 6 steering documents and the version-appropriate hook plan.

Current blocker: design/tasks await owner approval of requirements.

Main risks: decoder synchronization; mutually consistent but historically incorrect encoder/decoder; slow audio; browser memory growth. Competitive risks: usefulness and novelty.

Additional environment details recorded (2026-10-31, attributed to assisting agent):

- Kiro IDE: version 1.4.62 (package kiro 1.4.62-1793209285).
- Reference device for Req 13 benchmarks: Lenovo LOQ Essential 15IRX11 (83SC), Intel Core i5-13450HX, ~14.8 GiB RAM, Ubuntu 26.04 LTS x86_64, Google Chrome 155.0.8059.84. No measurements taken yet.
- ffprobe not found in local PATH; planned CI install on GitHub Actions ubuntu-24.04 via apt-get; unverified until a workflow runs.
- Kiro 1.4.62 hook schema: to be verified before any hook files are created.
- Req 13.5 corrected: missed targets must be reported; silent relaxation prohibited; target changes require a recorded design decision.

Owner action: review the requirements document (linked above), then approve to proceed to design.

Estimated owner effort: **5–10 minutes** for requirements review, then **20–30 minutes** for design/tasks review.
## Verified progress — 2026-10-31, Europe/Bucharest (design phase)

Stage: **M0 initial design generated; assisting-agent review found correctness blockers. Revisions required before tasks.md.**

Completed this session:

- Applied two requirements corrections: Req 15.9 UTF-8 bytes for "ă" (U+0103 → 0xC4 0x83, not 0xC3 0x84 "Ä"); Req 15.7 added non-zero starting phase fixture sub-case for decoder phase-independence testing.
- Created all six steering documents under `.kiro/steering/`: product, tech, structure, dsp-correctness, testing, accessibility.
- Created `.kiro/specs/tapeghost-mvp/design.md` (1,229 lines; passed `validate_spec_format` with no errors).

Key design decisions:

- Module boundary: `src/dsp/` is zero-browser-globals TypeScript, testable in Node.js. No React, no DOM, no AudioContext imports.
- Decoder uses quadrature correlator for frequency detection; T=1.5 energy ratio threshold; bit-period-aligned window advancement during carrier acquisition.
- Initial cancellation design uses a local flag checked per byte. Review found this ineffective because the message handler cannot set the flag during the synchronous loop; a yielding scheduler is required.
- `filename-in-text-envelope` added as a new `TghoError` kind (Kind=0 + FL≠0 validation gap in requirements).
- Buffer budget: ~4.2 MiB codec-owned at maximum payload, well within the 64 MiB limit.
- Wall-clock measured via `performance.now()` inside the worker; reported in result messages.
- WAV buffer is transferred (not copied) in both directions.

Repository status: `main`, `origin/main` up to date. No application code, no commit in this session. Git initialization authorship not verified.

Assisting-agent review (2026-10-31): reviewed design and steering, independently checked carrier/output arithmetic and a UTF-8 counterexample, and ran a standalone reproduction of the proposed post-acquisition symbol sampling. The reproduction failed for 26/160 sub-bit offsets at 48 kHz and 23/147 at 44.1 kHz. These are diagnostic findings, not application test results. No application implementation was added.

Next: Kiro resolves `docs/KIRO_DESIGN_REVIEW.md`, especially cancellation, symbol timing, parser bounds, and buffer ownership. Then review the revision and generate `tasks.md` with M1–M5 gates. Hook schema compatibility remains pending before configuration.

Owner action: paste the exact prompt in `docs/KIRO_DESIGN_REVIEW.md` into the existing Kiro spec conversation.

Estimated owner effort: **2–5 minutes** for the handoff and summary review, excluding Kiro runtime and subsequent technical review.

## Verified progress — 2026-11-02, Europe/Bucharest (design revision)

Stage: **M0 design revised per review; awaiting owner review before tasks.md.**

Completed this session (2026-11-02):

- Created branch `fix/design-review` from clean `main` (no local changes to preserve).
- Executed the full revision prompt from `docs/KIRO_DESIGN_REVIEW.md`, addressing all 8 findings.
- Revised `.kiro/specs/tapeghost-mvp/design.md` in place: fixed carrier/output arithmetic (2,183,040 samples, not 2,182,560), added decoder stage function signatures (`classifyBitPeriod`, `acquireCarrier`, `alignSymbols`, `frameByte`, `decodeWav` without `isCancelled`), added `runDecodeAsync` pseudocode, fixed progress reporting (per-chunk not per-byte), updated DSP step granularity table, replaced Stage 2 Removed with a note, updated ffprobe policy (CI fail, local visible skip), verified cancellation/properties/buffer-ownership/API-consistency fixes from the prior session were retained.
- Updated `.kiro/steering/dsp-correctness.md`: validation order step 6 now describes symbol alignment search (not start-bit search), step 7 references `frameByte` and three-way classifier, carrier minimum now shows sample counts at both rates (144,000 / 132,300), threshold T=1.5 labeled as proposed.
- Updated `.kiro/steering/testing.md`: ffprobe policy (CI fail, local visible skip), wall-clock measurement (both worker-internal and end-to-end), added worker cancellation/race and buffer lifecycle test categories.
- `design.md` passed `validate_spec_format` with no errors after revision.

Verification:

- `validate_spec_format` on `design.md`: no issues found.
- Arithmetic: independently verified `1104 × 11 × 160 = 1,943,040`; `240,000 + 1,943,040 = 2,183,040`; `2,183,040 × 2 = 4,366,080`; `4,366,080 + 44 = 4,366,124`. Matches `dsp-correctness.md` WAV file size.
- Old incorrect values (2,182,560 / 1,942,560) and the floating-point approximation Note are gone from `design.md`.
- `runDecodeAsync` pseudocode present with yields between stages.
- DSP Step Granularity table updated: carrier scan and symbol alignment as Single synchronous call.
- ffprobe code pattern uses `process.env.CI` to distinguish CI (throw) from local (console.warn + skip).
- `dsp-correctness.md` step 6 now describes symbol alignment search using TGHO magic bytes, not the old start-bit search.
- `testing.md` wall-clock section now says Record both worker-internal (performance.now()) and end-to-end (caller postMessage to response) measurements.
- No application source, tests, build, hook execution, or Kiro task execution has occurred.
- A commit was made on branch `fix/design-review` by the design workflow subagent (commit `4819d76`, message Progress with design.md file). This was not explicitly requested by the user but contains only the three intended file changes. The progress notes were then committed as `3d60069`, and the branch was pushed and opened as PR #1 against `main` at the owner's request.

Next: owner reviews the revised design. After approval, Kiro generates `tasks.md` with M1 to M5 gates. Hook schema compatibility remains pending before configuration.

Current blocker: design revision awaits owner review.

Main risks: threshold T=1.5 is unmeasured; cancellation 250 ms target is unmeasured; decoder symbol alignment search correctness is designed but not yet tested with real fixtures; no application code exists.

Owner action: review the revised design document and the Romanian change summary, then approve to proceed to tasks.md.

Estimated owner effort: **10 to 15 minutes** for design revision review.
