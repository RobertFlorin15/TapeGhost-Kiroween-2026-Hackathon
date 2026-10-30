# TapeGhost initial project plan

Prepared: 2026-10-30. Status: proposed baseline for the owner's architecture review in Kiro. No application functionality is implemented yet.

## Product and competition strategy

TapeGhost is a feasible browser-only educational instrument: type a message, hear its encoded sound, inspect its bits, import the exported WAV, and recover the message. Its intended audience is introductory computing students, teachers, and retro-computing enthusiasts. Do not market the MVP as a general archival recovery tool.

The strongest demo is a real round trip in a fresh page session, followed by an intentionally damaged recording producing an honest error. The biggest competitive weaknesses are usefulness and novelty. Address them with a short guided lesson and a small observed usability trial with students, recorded only after it happens.

Existing work establishes that file-to-audio conversion is not novel:

- [gstrike/py-kcs](https://github.com/gstrike/py-kcs) offers Python WAV encoding/decoding for KCS.
- [petervalencic/FSK-encoder-decoder](https://github.com/petervalencic/FSK-encoder-decoder) combines FSK file storage with Reed–Solomon correction.

These are references to inspect, not dependencies or validated interoperability partners. Audit licenses before reusing anything. TapeGhost's proposed distinction is an install-free, local, accessible explanation of every stage, with testable claims and transparent Kiro development evidence.

### Official competition checks

Checked the [rules](https://kiroween.devpost.com/rules), [overview](https://kiroween.devpost.com/), and [FAQ](https://kiroween.devpost.com/details/faqs) on 2026-10-30. Recheck before submission.

- Build window: October 30–December 4, 2026; deadline 14:00 PST, December 4, equivalent to **00:00 December 5 in Bucharest**. Internal target: December 3.
- Use Kiro substantively; insufficient use may disqualify. Provide a Kiro write-up, public GitHub source, recognizable open-source license, and tracked root `.kiro/`.
- Supply a working application URL, English materials, and public YouTube demonstration under three minutes. Keep judging access available through January 29, 2027.
- Student bonus: all teammates must qualify; provide LinkedIn, student email, year, degree, and institution in the submission. Enrollment proof may be requested. Confirm personal eligibility, including age, privately.
- Impact, technological implementation, design, innovation, and presentation each carry 20%.

Our development policy is stronger than merely checking these boxes: Kiro should implement and test the codec, own spec revisions, and execute useful automation. Final eligibility remains the organizers' decision.

## Three engineering risks

| Risk | Why it matters | Mitigation and exit evidence |
| --- | --- | --- |
| Synchronization and decoding | Detecting two tones is easier than locating byte boundaries; a wrong start offset corrupts every byte. | Carrier acquisition, start-bit timing search, per-character resynchronization, bounded framing checks; test unaligned leading silence and phase offsets. Defer speed variation. |
| False correctness | An encoder and decoder may share bit-order, framing, or CRC mistakes. | Independent hand-derived frames and cycle counts, independent WAV reader, CRC known-answer vector, separately authored fixture with provenance. |
| Duration and resource growth | 300 baud yields only about 27.27 framed bytes/s; large inputs cause long audio and allocations. | 1 KiB payload cap, explicit WAV limits, duration preview, typed arrays, worker boundary, measured time/memory budgets. |

## Historical basis and supported profile

The [BYTE February 1976 symposium report, printed pp. 72–73](https://deramp.com/swtpc.com/BYTE/Feb1976/Byte_Symposium.htm) specifies 300-baud signaling with four 1200 Hz cycles for zero and eight 2400 Hz cycles for one. Characters begin with zero, carry eight data positions least-significant first, and end with at least two ones. We choose eight data bits, no parity, exactly two stop bits (8N2).

Blocks have at least five seconds of mark tone before data. The physical tape recommendation places the first block at least 30 seconds after the clear leader begins; block contents are unspecified. TapeGhost will use the five-second carrier but omit physical tape positioning. Call the product **KCS-derived modulation and framing with a modern TapeGhost envelope**, not fully KCS-compliant or universally tape-compatible.

Related formats are not interchangeable: [Acorn's ACW service manual, section 4.1.5](https://chrisacorns.computinghistory.org.uk/docs/Acorn/Manuals/Acorn_ACW_SM.pdf) documents 300/1200-baud CUTS tones at the same frequencies. Matching frequencies alone does not establish matching symbol duration or file framing. Acorn/CUTS and native Tarbell formats are outside MVP support.

### Proposed TapeGhost v1 envelope

This is our design, not part of the historical standard. Freeze its byte layout in Kiro's design document before implementation:

| Field | Proposed representation |
| --- | --- |
| Magic | Four ASCII bytes `TGHO` |
| Version | One byte, value 1 |
| Kind | One byte: 0 for UTF-8 text, 1 for binary file |
| Filename length | Unsigned 16-bit little-endian, 0–64 UTF-8 bytes |
| Payload length | Unsigned 32-bit little-endian, 0–1024 bytes |
| Filename | Specified byte count; text uses zero bytes |
| Payload | Exact byte sequence, including zero bytes |
| CRC | Four-byte little-endian CRC-32/ISO-HDLC over all preceding envelope bytes |

Document all CRC parameters and verify the independent `123456789` known-answer value `0xCBF43926`. CRC is error detection, not correction or authentication. Never trust declared lengths to allocate unbounded memory. Reject unsupported versions/kinds and truncated or inconsistent envelopes. Sanitize filenames for download and render text as text, never HTML.

### Audio contract

- Output: RIFF/WAVE, format-tag 1 PCM, mono, signed 16-bit little-endian, 48,000 Hz; amplitude 0.75 full scale, defined starting phase, no timestamps or random dither.
- Input MVP: PCM16 mono WAV at 44,100 or 48,000 Hz containing the TapeGhost profile; at most 8 MiB and 60 seconds. Reject compressed audio, other channel counts, unsupported rates, malformed chunks, and oversize input with explicit messages.
- Parse WAV chunks directly for decoding; do not depend on playback resampling. Honor chunk sizes and odd-byte padding; skip bounded unknown chunks. Do not assume every WAV has a 44-byte header. See [Microsoft's RIFF documentation](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-).
- At 48 kHz, each bit is 160 samples; at 44.1 kHz, it is 147. The maximum proposed envelope is 1104 bytes. With five-second carrier, output is 45.48 seconds and 4,366,124 bytes with a minimal WAV header. These are calculated limits, not benchmark measurements.
- Identical input/options must produce identical WAV bytes on the tested runtime. Before promising cross-engine byte identity, check waveform rounding across supported engines.

## Technology and module boundaries

Keep React, TypeScript strict mode, Vite, Tailwind CSS, Web Audio API, and Canvas. Use ordinary HTML for accessible controls and textual equivalents of visualizations. Use npm with a committed lockfile; select supported compatible versions when Kiro initializes the project rather than guessing version numbers now.

Use Vitest for codec tests, fast-check with fixed seeds for bounded byte properties, and Playwright for essential browser flows. Add ESLint, Prettier, and TypeScript checks. Recommend MIT for our original code; check reused asset/dependency licenses separately. Prefer Cloudflare Pages for the static build; provider/account configuration remains to be verified during deployment.

No backend, login, database, paid API, Rust, or WebAssembly is needed. Put compute behind a Web Worker for responsive progress/cancellation. The DSP module itself must run in a test process with no browser globals.

Decoder starting design: compare energy at the two expected frequencies using quadrature correlation or Goertzel, acquire the carrier, search for the first valid start bit, sample framed symbols, and reacquire timing at each byte. Reject low-confidence/invalid framing. Zero-crossing decoding is simpler but more vulnerable to noisy transitions; FFT spectrograms are optional visualization, not required decoding infrastructure. Benchmark before adding sophisticated clock recovery.

Planned repository (only the three planning documents currently exist):

```text
SKILL.md
.kiro/
  steering/                 # product, tech, structure, DSP, testing, accessibility
  specs/tapeghost-mvp/       # requirements.md, design.md, tasks.md
  hooks/                    # generated for the installed Kiro version
src/
  dsp/                      # envelope, CRC, framing, FSK, WAV, decoder, errors
  workers/codec.worker.ts   # compute/progress/cancellation adapter
  audio/                    # playback and AudioContext lifecycle
  components/               # cassette controls, waveform, bit inspector
  App.tsx
tests/
  unit/
  fixtures/                 # provenance and independent reference vectors
  e2e/
docs/
  PROJECT_PLAN.md
  KIRO_FIRST_PROMPT.md
  KIRO_USAGE.md              # created by actual Kiro work
  FORMAT.md                 # frozen wire contract after design approval
  submission/               # pitch, demo script, final checklist
README.md
LICENSE
package.json
package-lock.json
```

## MVP acceptance criteria

1. Encode and recover empty payloads, ASCII, Romanian diacritics, emoji, arbitrary binary bytes, and lengths 0, 1, 255, 256, 1023, and 1024. Enforce UTF-8 byte length rather than JavaScript character count; reject 1025 bytes. Preserve binary bytes and supported filename metadata.
2. Independently verify both tone frequencies, cycle counts, sample counts, LSB order, start/stop bits, carrier duration, RIFF sizes, and PCM parameters. Include hand-derived `0x00`, `0xFF`, `0x01`, and `0xA5` frame expectations. A second WAV reader must accept generated output.
3. Decode actual WAV samples after clearing encoder/UI state. Test clean fixtures at both supported rates, arbitrary sample alignment after 0–1 second of leading silence, constant gain factors 0.25–1 relative to generated audio, and different initial phases. Physical recording, resampling artifacts, noise, and speed drift are deferred.
4. Run seeded byte-array properties, with many short cases and explicit maximum-size cases. Separate envelope/framing properties from expensive audio properties. Keep seeds and runtime limits reproducible.
5. Reject unsupported WAV, invalid lengths, truncation, silence, invalid framing, unknown envelope versions, and CRC mismatches without crashes or false success. Include a validly modulated payload mutation with the old CRC. Do not claim every possible corruption is detectable.
6. Provide text/file input, byte count and estimated duration, export, user-triggered play/stop, WAV import, recovered text/file download, and distinct decoding/integrity status. No autoplay or payload transmission to a server.
7. Show waveform plus selected bits and measured/expected tone labels. Use semantic controls, keyboard access, visible focus, text status, adequate contrast, reduced-motion support, and a usable 360 px layout. Essential understanding must not depend on hearing or color.
8. Proposed performance target: maximum payload encode and decode each under two seconds on a documented reference laptop/browser, excluding playback; codec-owned working buffers below 64 MiB; cancellation acknowledged within 250 ms. Measure before claiming these targets, and revise transparently if necessary.
9. Unit, type, lint, production build, and essential Playwright round-trip/error checks pass. Test Chromium and Firefox, then conduct an actual mobile-browser smoke test and record the tested versions. Publish the actual support matrix.

## Kiro-centered milestones

| Milestone | Kiro work and completion gate | Estimated owner effort |
| --- | --- | --- |
| M0: initial spec | Native requirements/design/tasks, steering, version-aware hook plan, owner architecture review. No feature marked implemented. | 20–30 min |
| M1: encoder | Scaffold, frozen format, envelope/CRC/framing/FSK/WAV modules; independent signal and WAV checks pass. | 20–30 min |
| M2: round trip | Decoder, bounded parsing, sync/error handling; fresh-session recovery, independent fixture, corruption tests pass. This is the critical gate. | 30–45 min |
| M3: usable product | Worker, playback, upload/download, accessible retro cassette interface; core browser workflows pass. | 20–30 min |
| M4: explain and polish | Waveform/bit lesson, measured performance, accessibility, small usability trial; no regression. | 20–40 min |
| M5: release | Reproducible setup, CI, license, Kiro evidence, static deployment, real demo and English submission materials. Owner publishes/submits. | 45–60 min |

Effort estimates exclude agent runtime, account provisioning, and unexpected debugging. Cut M4 embellishments first if time is limited. Do not cut the M2 gate or invent test success to meet a schedule.

## Kiro evidence and automation

Use native [Feature Specs](https://kiro.dev/docs/specs/) to maintain requirements, design, and task status. Use [project steering](https://kiro.dev/docs/steering/) for recurring product/stack/structure, DSP, testing, performance, and accessibility constraints. These are working artifacts to revise when a test exposes a design error.

The current [hooks documentation](https://kiro.dev/docs/hooks/) describes JSON hooks with `PostFileSave`, regex matchers, and command actions. Installed versions may differ: verify the owner's version before generating files. Plan a narrowly matched DSP save hook running targeted tests and a task-boundary quality check; avoid repeating the full suite on every edit. Do not assume file events include manual editor saves. Prove an actual supported trigger fired, and record it separately from manual test execution.

For each Kiro task, record date/version, task ID, affected files/commit, actual commands/results, bug or design improvement, and evidence location in `docs/KIRO_USAGE.md`. Store small sanitized excerpts or screenshots when useful. Record automation run counts/failures from logs; only claim time savings if measured. This planning session must be credited separately.

## Release demonstration proposal

Target 2:30 total: establish the educational problem, type a short message, explain a zero/one waveform, generate and briefly play real audio, download/import in a fresh session, recover identical text with CRC verified, show one corrupted-input failure, then show actual Kiro spec/test/hook evidence. Keep the message short enough that authentic 300-baud playback does not dominate the video. Record only implemented behavior.
