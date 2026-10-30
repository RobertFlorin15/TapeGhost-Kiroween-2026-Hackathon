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
- Read `.kiro/specs/tapeghost-mvp/` for the implementation contract. Only `requirements.md` and `.config.kiro` exist at this checkpoint; design/tasks remain pending. Read `docs/KIRO_USAGE.md` for evidence once Kiro creates it.

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

Owner action: review revised requirements, then approve to proceed to design. Check Help → About in Kiro IDE for the version number to record in `docs/KIRO_USAGE.md`.

Estimated owner effort: **5–10 minutes** for requirements review, then **20–30 minutes** for design/tasks review.