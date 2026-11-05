# TapeGhost — Demo Script (to record)

**This is a script to record, not a claim that a video exists.** Target length: **≤ 3
minutes**. Platform: YouTube (public or unlisted). Record the actual browser version
and conditions at recording time.

> **Keep the message very short** (for example `HELLO` or `hi`). Authentic 300-baud
> playback is slow, and a long message would make the carrier and data tones dominate
> the video. A few bytes is enough to show the whole round trip inside the time budget.

## Shot list and timing

| Time | Shot | On screen | Narration (gist) |
|------|------|-----------|------------------|
| 0:00–0:20 | **Hook / problem** | Title card, then the app loaded in a browser | "On old home computers, files were stored as sound on cassette tape. TapeGhost lets you see and hear how that worked — in the browser, nothing to install." |
| 0:20–0:40 | **Type a message** | Click the text field, type a short message (e.g. `HELLO`); byte counter visible | "I type a short message. TapeGhost will turn these bytes into audio." |
| 0:40–1:05 | **Explain a bit** | Encode; zoom the waveform; use the bit inspector to point at one `0` and one `1` | "A zero is a lower 1200 Hz tone, a one is a higher 2400 Hz tone. Here's a zero, and here's a one — you can actually read the bits." |
| 1:05–1:25 | **Hear it** | Press Play; let a second or two of carrier + data play, then stop | "This is the real audio — five seconds of carrier tone, then the data. I'll play just a moment of it." |
| 1:25–1:45 | **Export + fresh session** | Download the WAV; open the app again in a **fresh browser session** (new tab/window, no prior state) | "I export the WAV and reopen TapeGhost completely fresh — no memory of what I just did." |
| 1:45–2:10 | **Recover** | Import the downloaded WAV; decode; recovered text shown with a clear **CRC verified** status | "I import the file I just saved. The bytes come back identical, and the CRC integrity check passes." |
| 2:10–2:30 | **Failure path** | Use a corrupted input (envelope-level mutation, per the test procedure); decode; show the distinct **CRC mismatch** error and that no payload is returned | "If the data is damaged, TapeGhost doesn't guess — it reports a CRC mismatch and returns nothing. Honest failure." |
| 2:30–2:55 | **Built with Kiro** | Show the `.kiro/` specs/steering and the passing test run (unit + E2E) | "This was built with Kiro's spec workflow — requirements, design, tasks — all tracked, with an honest usage log and a passing test suite across two browsers." |
| 2:55–3:00 | **Close** | Tagline card + project URL | "TapeGhost — bring forgotten data back to life." |

## Recording checklist

- Use a short message so playback fits the time budget.
- The import step must happen in a **genuinely fresh session** (no leftover state), so the
  recovery is clearly a real decode, not a cached result.
- For the failure shot, use the documented **envelope-level mutation** path (a known CRC
  mismatch), not random byte flipping of the WAV.
- Capture and note the browser name and version used while recording.
- Do not claim vintage-tape compatibility or any unmeasured performance figure on camera.
