# TapeGhost — Pitch

**Kiroween 2026 · Resurrection category**

*Bring forgotten data back to life.*

## The problem

For a generation of home computers, programs and data lived on ordinary audio
cassettes. Files literally *were* sound. That idea is a wonderful teaching moment —
you can hear a bit flip — but it is nearly impossible to show a classroom today. The
hardware is gone, the formats are fragmented, and most demonstrations are either
hand-wavy diagrams or black boxes that hide the interesting part. Students are left to
take "data became sound" on faith.

## What TapeGhost does

TapeGhost resurrects that experience in the browser, with nothing to install. Type a
short message (or pick a small file), and TapeGhost modulates it into real 300-baud FSK
audio — 1200 Hz for a zero, 2400 Hz for a one — wraps it in a documented envelope with
a CRC-32 integrity check, and lets you *play it, see its waveform, and inspect
individual bits*. Export the WAV, reopen the app fresh, import the file, and watch the
original bytes come back with the checksum verified. Corrupt the data and TapeGhost
tells you exactly what went wrong.

## Why it's defensible

- **Every stage is inspectable:** waveform view and a keyboard-operable bit inspector
  turn the pipeline into something you can read, not just trust.
- **Honest, testable claims:** the round trip is covered by unit, property-based, and
  cross-browser end-to-end tests; limitations are documented, not glossed over.
- **Transparent Kiro development:** the `.kiro/` specs and steering are tracked, and
  `docs/KIRO_USAGE.md` logs what Kiro actually did.
- **Accessible by design:** fully keyboard-operable, and no meaning depends on color or
  on hearing the audio.

## Scope, stated plainly

TapeGhost is an educational tool. It is KCS-*derived*, not vintage-tape-compatible, and
it does not claim interoperability with real cassette formats. That honesty is the
point: a clear, correct, inspectable teaching model beats an overreaching one.
