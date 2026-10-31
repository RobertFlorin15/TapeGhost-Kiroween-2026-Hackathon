# Kiro Usage Log — TapeGhost

This file records only actions actually performed by Kiro in this project. Planning work by the assisting agent is attributed separately. Entries are added chronologically; claims are not made for sessions or operations not directly observed.

---

## Session 1 — 2026-10-30, requirements phase

**Kiro surface:** Kiro IDE (VS Code-based), version not directly observable from within this session. Version marked unknown pending owner confirmation.

**Node / npm:** Not yet checked; project scaffold not yet created.

**Repository status at session start:** Git repository present (initialized by assisting agent prior to this session). No application source, `package.json`, or lock file existed. Files present: `SKILL.md`, `docs/PROJECT_PLAN.md`, `docs/KIRO_FIRST_PROMPT.md`, `docs/KIRO_REQUIREMENTS_REVIEW.md`, `.gitignore`.

---

### Actions performed

**Step 1 — Feature spec initialized**

Kiro created `.kiro/specs/tapeghost-mvp/.config.kiro` with content:
```json
{"specId": "7ae4cbba-ec75-4b5e-894a-52578cebd162", "workflowType": "requirements-first", "specType": "feature"}
```
This is the native Feature Spec configuration for the `tapeghost-mvp` feature, requirements-first workflow.

**Step 2 — requirements.md generated (initial)**

Kiro generated `.kiro/specs/tapeghost-mvp/requirements.md` containing 18 requirements organized across Encoding, Decoding, Format/Envelope, Audio, UI/UX, Accessibility, Performance, and Testing groups. The file passed `validate_spec_format` with no errors.

Requirements covered:
- Req 1–2: Text and binary payload encoding with 1024-byte cap (UTF-8 byte length, not JS character count)
- Req 3: TGHO envelope serialization with CRC-32/ISO-HDLC known-answer
- Req 4: FSK signal generation (1200/2400 Hz, 8N2 framing, 160 samples/bit at 48 kHz)
- Req 5: WAV output format (RIFF/PCM16 mono 48 kHz)
- Req 6–7: Payload decoding and TGHO envelope parsing
- Req 8: Graceful error handling (11 error categories)
- Req 9–11: UI encoding/decoding/waveform flows
- Req 12: Accessibility (keyboard, ARIA, 360 px, reduced motion)
- Req 13–14: Performance targets and codec worker isolation
- Req 15–18: Testing (signal independence, PBT, rejection paths, CI)

**Step 3 — requirements.md revised (review corrections)**

The assisting agent reviewed the initial requirements and produced a targeted revision prompt (stored in `docs/KIRO_REQUIREMENTS_REVIEW.md`). Kiro applied all 8 review findings:

| Finding | Criteria changed | Summary |
|---------|-----------------|---------|
| 1 | Req 5.3 | Removed zero-size exception from WAV header formula |
| 2 | Req 4.6, Req 9.3 | Frozen MVP carrier to exactly 5 s; added decoder minimum (≥3 s); duration estimator uses `5 + (16 + filename + payload) × 11 / 300` |
| 3 | Req 2.4, Req 7.10 | UTF-8 filenames up to 64 bytes stored raw; sanitization affects download name only, not payload; "proprietary" → "custom, openly documented" in Glossary |
| 4 | Req 6.11–6.12, Req 8.2–8.3 | Decoder must consume full envelope including CRC before success; Kind=0 enforces zero filename length; strict framing (no 10% allowance); carrier acquisition defined explicitly |
| 5 | Req 17.1–17.2, Req 18.3 | CRC-mismatch test uses envelope-level mutation + audio path; unsupported profiles use `unsupported-wav-profile` category with detail string; E2E test requires fresh page session |
| 6 | Req 11.6, Req 9.8, Req 10.5 | Keyboard-operable bit-inspection region selector added; play/stop available for newly encoded audio before export |
| 7 | Req 13.1–13.4, Req 14.3 | Performance targets deferred to recorded measurement; memory budget by codec instrumentation (not browser API); cancellation measured from caller's post timestamp with checkpoint approach |
| 8 | Req 15.6–15.9 | Exact 1200/2400 Hz assertions with ±5 Hz tolerance and cycle-count verification; decoder tests at both sample rates with leading-silence variants; independently-authored fixture with provenance; boundary/Unicode round-trip cases |

The revised file passed `validate_spec_format` with no errors.

---

### Files created or modified by Kiro this session

| File | Action | Notes |
|------|--------|-------|
| `.kiro/specs/tapeghost-mvp/.config.kiro` | Created | Spec configuration |
| `.kiro/specs/tapeghost-mvp/requirements.md` | Created, then revised | 18 requirements; revised per review |
| `docs/KIRO_USAGE.md` | Created | This file |

---

### Not yet done (pending owner review)

- `design.md` — pending owner approval of requirements
- `tasks.md` — pending design approval
- Steering documents (6 files under `.kiro/steering/`) — pending
- Hook plan — pending (version-appropriate schema to be verified)
- Repository scaffold (`package.json`, source tree, CI) — M1, not started
- No application code, tests, or builds have been executed
- No deployment, demo video, or submission exists
- Git commit has not been made; all changes remain unstaged

---

### Observed limitations and unresolved items

- Kiro version could not be read from within the IDE session; marked unknown. Owner should check Help → About.
- Node.js and npm versions not yet checked; project has no `package.json`.
- Performance targets in Req 13 are explicitly marked as pending measurement on a concrete recorded device; the reference device has not yet been documented.
- The `ffprobe` verification command in Req 5.5 assumes `ffprobe` is available in the CI environment; this dependency has not been verified.
- `.gitignore` was created by the assisting agent, not Kiro; it has not been committed.
- No hook files exist; the hook plan will be written after the design is approved and the Kiro hook schema for the installed version is confirmed.


---

## Environment inspection — 2026-10-31, attributed to assisting agent

These findings were recorded by the assisting agent from local environment inspection, not from Kiro execution. They supplement the Session 1 log above.

**Kiro IDE version:** 1.4.62, confirmed from installed application metadata and Debian package `kiro 1.4.62-1793209285`.

**Reference device for performance benchmarks (Req 13):**
- Device: Lenovo LOQ Essential 15IRX11, model 83SC
- CPU: Intel Core i5-13450HX
- RAM: approximately 14.8 GiB OS-visible
- OS: Ubuntu 26.04 LTS, x86_64
- Reference browser: Google Chrome 155.0.8059.84

No performance measurements have been taken. The 2-second encode/decode targets in Req 13.1–13.2 remain pending first measurement on this device. The reference browser version and execution conditions must be re-recorded at the time benchmarks actually run.

**ffprobe availability:** `ffprobe` was not found in the local PATH. The `ffprobe` verification in Req 5.5 cannot be run locally without installation. No CI workflow exists yet.

**Planned CI environment (unverified, not yet executed):**
- Runner: GitHub Actions `ubuntu-24.04`
- `ffprobe` installation: `sudo apt-get update && sudo apt-get install -y ffmpeg` then verified with `ffprobe -version`
- This CI setup is planned and unverified until a workflow file is created and a run completes successfully.

**Hook compatibility note:** Kiro 1.4.62 hook schema compatibility must be verified before any `.kiro/hooks/` files are created. No hook configurations exist yet. The hook plan will be developed after design approval.

**Step 4 — Req 13.5 fix (2026-10-31)**

Corrected Req 13 criterion 5: removed the clause that allowed silently relaxing performance targets after a missed measurement. The criterion now requires reporting any exceedance and its measured value in this file, and explicitly prohibits changing a target without a recorded design decision. No other criteria were changed. File passed `validate_spec_format` with no errors.


---

## Session 2 — 2026-10-31, design phase

**Kiro IDE version:** 1.4.62 (confirmed by assisting agent from Debian package metadata; see environment inspection entry above).

**Repository status at session start:**
- Branch: `main`, up to date with `origin/main` (origin present; authorship of initial git initialization not verified)
- Modified (unstaged): `requirements.md`, `SKILL.md`, `docs/KIRO_USAGE.md`
- `.kiro/steering/` did not exist

---

### Actions performed

**Step 1 — Requirements corrections (Req 15.7 and 15.9)**

Two targeted fixes applied to `.kiro/specs/tapeghost-mvp/requirements.md`:
- Req 15.9: corrected UTF-8 bytes for "ă" (U+0103) from `0xC3 0x84` (which is "Ä") to `0xC4 0x83`.
- Req 15.7: added sub-case (d) — a fixture with no leading silence and a non-zero carrier starting phase (e.g., π/4 radians) — to verify decoder phase independence. Sub-cases (a)–(c) updated to explicitly state "carrier starting phase 0 radians".

File passed `validate_spec_format` with no errors after both corrections.

**Step 2 — Six steering documents created**

All six planned steering documents created under `.kiro/steering/`:

| File | Inclusion | Contents |
|------|-----------|----------|
| `product.md` | auto | Purpose, competition context, MVP scope, out-of-scope list, honesty rules, round-trip gate |
| `tech.md` | auto | Stack table, module independence rule, dependency policy, TypeScript strict mode, performance conventions, determinism, reference device |
| `structure.md` | auto | Repository layout, naming conventions, `.kiro` tracking rule, sensitive-files policy |
| `dsp-correctness.md` | auto | Historical basis, frozen TGHO byte-offset table, CRC-32/ISO-HDLC parameters, FSK signal parameters, WAV output format, audio duration formula, validation order (15 steps), independence rule |
| `testing.md` | auto | Test framework, DSP testability requirement, test category/file table, PBT rules, signal independence rules, fixture rules, CRC-mismatch procedure, unsupported-profile test approach, E2E requirements, ffprobe CI plan, performance measurement policy |
| `accessibility.md` | auto | WCAG 2.1 AA target, semantic HTML rules, keyboard operation requirements, focus indicator spec (2px, 3:1 contrast), color/modality rules, viewport (360 px), motion (prefers-reduced-motion), manual check requirement |

All files use default (auto) inclusion — they are present on every Kiro context load.

**Step 3 — design.md created**

Kiro created `.kiro/specs/tapeghost-mvp/design.md` (1,229 lines). File passed `validate_spec_format` with no errors.

Design document covers:

| Section | Contents |
|---------|----------|
| Architecture | ASCII module boundary diagram, Mermaid data-flow diagram |
| TypeScript types | Full discriminated union for 14+ `TghoError` kinds (incl. new `filename-in-text-envelope`), `EncodeRequest/Result`, `DecodeRequest/Result`, `WorkerRequest/Response` tagged unions, all DSP function signatures |
| TGHO wire contract | Frozen byte-offset table, 11-step `parseEnvelope` validation order, `serializeEnvelope` build sequence |
| CRC | Parameters, KAT (`0xCBF43926`) |
| FSK generation | `generateBit` contract, phase continuity invariant, encoder pipeline, 44-byte WAV header layout |
| WAV parser | Chunk-traversal algorithm (no fixed 44-byte assumption), 4 rejection conditions with exact `detail` strings |
| Decoder algorithm | 4 stages: carrier acquisition (quadrature correlator, T=1.5, bit-period-aligned windows), start-bit search (10k limit), byte framing (LSB-first, strict stop-bit check), envelope termination |
| 44.1 kHz | samplesPerBit=147, carrierMinBits=882, adapted phaseStep values |
| Worker protocol | Cancellation model explanation (flag not event), transferable buffer table, progress reporting stages |
| Testing strategy | Req→test mapping table, PBT config, independent fixture provenance format, CRC-mismatch two-path procedure, ffprobe CI skip pattern |
| Performance | Buffer budget table (~4.2 MiB codec-owned, well within 64 MiB), wall-clock measurement via `performance.now()` in worker |
| Accessible UI | Minimal HTML for encode/decode/waveform panels with ARIA roles, live-region politeness, keyboard numeric region selector, canvas text alternative |
| Correctness properties | 7 properties: envelope round-trip, audio round-trip, short-payload coverage, CRC KAT, framing invertibility, error-produces-no-payload, oversized-payload rejection |

**Design decision recorded:** Added `{ kind: 'filename-in-text-envelope' }` to `TghoError` union to cover the Kind=0 + Filename Length ≠ 0 case (Req 6.12), which requirements left without a named error kind. This avoids overloading `magic-mismatch` for a distinct validation failure.

---

### Files created or modified this session

| File | Action |
|------|--------|
| `.kiro/specs/tapeghost-mvp/requirements.md` | Modified (Req 15.7, 15.9 corrections) |
| `.kiro/steering/product.md` | Created |
| `.kiro/steering/tech.md` | Created |
| `.kiro/steering/structure.md` | Created |
| `.kiro/steering/dsp-correctness.md` | Created |
| `.kiro/steering/testing.md` | Created |
| `.kiro/steering/accessibility.md` | Created |
| `.kiro/specs/tapeghost-mvp/design.md` | Created |
| `docs/KIRO_USAGE.md` | Modified (this entry) |
| `SKILL.md` | Modified (progress update) |

---

### Not yet done (pending owner design review)

- `tasks.md` — pending owner approval of design.md
- Hook configuration — pending Kiro 1.4.62 schema verification
- Repository scaffold (`package.json`, source tree) — M1, not started
- No application code, tests, or builds have been executed
- No deployment, demo video, or submission exists
- No Git commit has been made in this session

