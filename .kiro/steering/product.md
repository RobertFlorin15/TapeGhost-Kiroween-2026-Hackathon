# Product steering — TapeGhost

## Purpose

TapeGhost is a browser-only educational tool that converts text or small binary files into FSK audio, plays that audio, exports a WAV file, and recovers the original bytes with CRC integrity checking. The target audience is introductory computing students, teachers, and retro-computing enthusiasts.

## Competition context

Kiroween 2026, Resurrection category. Build window: 2026-10-30 – 2026-12-04 (deadline 14:00 PST, equivalent to 00:00 December 5 Bucharest time). Internal target: December 3. Use Kiro substantively; provide public GitHub source, recognizable open-source license, tracked `.kiro/`, working application URL, and a public YouTube demonstration under three minutes.

## Tagline

Bring forgotten data back to life.

## MVP scope

- Text input (UTF-8, ≤1024 bytes) and binary file input (≤1024 bytes)
- Encode to WAV (KCS-derived FSK, TGHO envelope, CRC-32/ISO-HDLC)
- Play encoded audio in-browser (user-triggered)
- Export WAV file
- Import WAV file and decode
- Display recovered text or offer recovered binary file for download
- Show CRC integrity status, distinct error messages for every failure mode
- Accessible waveform and bit inspector with keyboard-operable region selection

## Out of scope (MVP)

Physical tape tolerance (noise, flutter, resampling), CUTS/Acorn/Tarbell compatibility, Reed-Solomon error correction, backend services, authentication, multi-channel or lossy audio input.

## Honesty rules

- Do not claim a feature is implemented or tested until a reproducible check passes.
- Record failures and limitations alongside successes.
- Do not claim compatibility with arbitrary vintage tapes or physical cassette recordings.
- Performance targets are goals pending measurement; a missed target must be reported, not silently relaxed.
- Distinguish what Kiro did from what the assisting agent planned.

## Round-trip gate

The complete encode/decode round trip must be verified before any decorative UI work or optional audio effects are added. This is the M2 gate and it is non-negotiable.
