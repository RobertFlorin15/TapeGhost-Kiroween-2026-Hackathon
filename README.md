# TapeGhost

**Bring forgotten data back to life.**

TapeGhost is a browser-only educational tool that turns a short piece of text or a
small binary file into frequency-shift-keyed (FSK) audio, plays that audio, exports
it as a WAV file, and then reads a WAV file back to recover the original bytes with an
integrity check. It is built for introductory computing students, teachers, and
retro-computing enthusiasts who want to *see and hear* how data was once stored as
sound on cassette tape. It uses **KCS-derived modulation with a custom, openly
documented envelope (TGHO)**. It is a teaching tool, not an archival recovery tool: it
is **not** compatible with physical vintage cassette recordings and does **not**
interoperate with the CUTS, Acorn, or Tarbell formats.

## How it works

- **Modulation:** 300-baud FSK. A logic `0` is 1200 Hz (4 complete cycles per
  bit-period); a logic `1` is 2400 Hz (8 complete cycles per bit-period).
- **Framing:** 8N2 — one start bit, eight data bits (LSB first), two stop bits.
- **Carrier:** the encoder emits exactly 5 seconds of 2400 Hz leading tone before the
  data so the decoder can lock on.
- **Envelope:** payload bytes are wrapped in a TGHO envelope (magic `TGHO`, version,
  kind, filename, payload) terminated by a **CRC-32/ISO-HDLC** checksum. The CRC is an
  integrity check only — it detects corruption, it does not correct or encrypt data.
- **Audio:** 48,000 Hz, 16-bit signed mono PCM in a standard RIFF/WAVE container.

## Features (MVP)

- Text input (UTF-8, up to 1024 bytes) or a binary file (up to 1024 bytes).
- Encode to a WAV file.
- Play the encoded audio in the browser (user-triggered).
- Export the WAV file.
- Import a WAV file and decode it.
- Display recovered text, or offer the recovered binary file for download.
- Show CRC integrity status and a distinct message for every failure mode.
- Accessible waveform display and a keyboard-operable bit inspector.

## Not in scope

- Physical tape tolerance — noise, tape flutter, speed/pitch variation, resampling.
- Compatibility with CUTS, Acorn, Tarbell, or any real vintage cassette format.
- Forward error correction (the CRC detects errors; it does not repair them).
- Any backend, account system, or database. Everything runs in the browser.

## Requirements

- Node.js 22 or newer, and npm.
- `ffprobe` (from `ffmpeg`) is needed only for the WAV-structure test. CI installs it;
  locally that single test skips with a warning if `ffprobe` is not on your PATH.

## Install

```bash
npm ci       # reproducible install from the committed lockfile
# or: npm install
```

## Run (dev)

```bash
npm run dev
```

Then open http://localhost:5173.

## Build

```bash
npm run build
```

The static site is emitted to `dist/`.

## Test

```bash
npm test          # Vitest: unit + property-based tests (single run)
npm run typecheck # TypeScript strict type check (app + worker)
npm run lint      # ESLint

# End-to-end (Playwright, Chromium + Firefox).
# Install the browsers once, then run the suite:
npx playwright install chromium firefox
npm run test:e2e
```

## Project structure

```
src/
  dsp/          Pure TypeScript codec — no browser globals; runs in plain Node
  workers/      Web Worker codec host (message protocol, cancellation, progress)
  audio/        Web Audio API playback (AudioContext lifecycle)
  components/   React UI components (no codec logic)
tests/
  unit/         Vitest unit + property-based tests
  fixtures/     Independently authored and generated test fixtures
  e2e/          Playwright end-to-end specs
.kiro/
  specs/        requirements.md, design.md, tasks.md for the MVP
  steering/     Product, tech, structure, DSP-correctness, testing, accessibility
```

## Status

Honest snapshot of where the project stands:

- **Codec, worker, and UI:** implemented and tested — 140 unit/property tests pass
  (one `ffprobe`-gated WAV test skips locally) and 24 E2E tests pass on Chromium and
  Firefox.
- **Performance:** measured in Node on the reference device (encode under ~112 ms,
  decode under ~240 ms for the maximum payload), comfortably under the 2-second goal.
  The in-browser (Chrome 155) benchmark is **pending** — Node V8 timings are
  indicative, not a substitute for the browser measurement the target is defined for.
- **Accessibility:** automated keyboard-reachability, visible-focus, 360 px layout, and
  reduced-motion checks pass on both engines. A manual screen-reader and keyboard-only
  human walkthrough is **pending** and is required before release.
- **Deployment URL:** pending (to be added once the app is deployed).
- **Demo video:** pending (to be added once recorded).

Performance and accessibility targets are goals pending the measurements and manual
audit noted above; any missed target is recorded in `docs/KIRO_USAGE.md` rather than
quietly relaxed.

## Built with Kiro

TapeGhost was built using Kiro's spec workflow — requirements, then design, then
tasks — with the `.kiro/` directory (specs and steering) tracked in Git as part of the
project. `docs/KIRO_USAGE.md` is an honest, chronological log of what Kiro actually did
versus what the assisting agent planned.

## License

MIT. See [LICENSE](LICENSE).
