# DSP correctness steering — TapeGhost

## Historical basis

BYTE February 1976 symposium report (pp. 72–73): 300-baud signaling, 1200 Hz for logic zero (4 cycles per bit-period), 2400 Hz for logic one (8 cycles per bit-period), 8N2 framing, LSB-first bit order, at least 5 seconds of mark tone before data.

TapeGhost is described as **KCS-derived modulation with a modern TGHO envelope**. It is not claimed to be universally KCS-compliant, physically tape-compatible, or interoperable with CUTS, Acorn, or Tarbell formats.

## TGHO envelope — frozen byte layout

| Offset | Size | Field | Encoding |
|--------|------|-------|----------|
| 0 | 4 | Magic | ASCII `TGHO` (0x54 0x47 0x48 0x4F) |
| 4 | 1 | Version | uint8, value 1 |
| 5 | 1 | Kind | uint8: 0 = UTF-8 text, 1 = binary file |
| 6 | 2 | Filename Length | uint16 little-endian, 0–64 |
| 8 | 4 | Payload Length | uint32 little-endian, 0–1024 |
| 12 | var | Filename | UTF-8 bytes, count = Filename Length |
| 12 + FL | var | Payload | raw bytes, count = Payload Length |
| 12 + FL + PL | 4 | CRC | uint32 little-endian, CRC-32/ISO-HDLC over all preceding bytes |

Fixed header = 12 bytes. Total minimum envelope = 16 bytes (empty payload, no filename). Maximum envelope = 12 + 64 + 1024 + 4 = 1104 bytes.

## CRC-32/ISO-HDLC parameters

- Polynomial: 0x04C11DB7 (reflected: 0xEDB88320)
- Initial value: 0xFFFFFFFF
- Input reflected: yes
- Output reflected: yes
- Final XOR: 0xFFFFFFFF
- Known-answer test: CRC-32/ISO-HDLC of ASCII `123456789` = `0xCBF43926`

CRC is error detection only. It does not correct errors, encrypt data, or establish authenticity.

## FSK signal parameters

| Parameter | Value |
|-----------|-------|
| Baud rate | 300 symbols/second |
| Logic zero | 1200 Hz, 4 complete cycles per bit-period |
| Logic one | 2400 Hz, 8 complete cycles per bit-period |
| Output sample rate | 48,000 Hz |
| Samples per bit-period | 160 |
| Framing | 8N2: 1 start bit (0) + 8 data bits + 2 stop bits (1) |
| Bit order | LSB-first |
| Carrier duration (encoder) | Exactly 5 seconds = 240,000 samples |
| Carrier minimum (decoder) | ≥3 seconds of continuous 2400 Hz (900 bit-periods = 144,000 samples at 48 kHz; 132,300 samples at 44.1 kHz) before accepting data |
| Amplitude | 0.75 × 32767 ≈ 24575 peak (signed 16-bit) |
| Starting phase | 0 radians; continuous — no reset between bits or characters |

> **Frequency classifier threshold**: the ratio threshold T = 1.5 is a **proposed value, pending measurement** on real fixtures at gain factors 0.25 and 1.0. It must not be presented as empirically established until measured. The classifier uses a three-way result (`'one'`, `'zero'`, `'ambiguous'`); `'ambiguous'` during data framing triggers a framing-error.

## WAV output format

| Field | Value |
|-------|-------|
| Container | RIFF/WAVE |
| Format tag | 1 (PCM) |
| Channels | 1 (mono) |
| Sample rate | 48,000 Hz |
| Bit depth | 16 bits, signed, little-endian |
| Byte rate | 96,000 bytes/second |
| Block align | 2 bytes |
| Data chunk size | sample_count × 2 |
| RIFF chunk size | 36 + (sample_count × 2) |
| No timestamps, metadata chunks, or dither of any kind |

## Audio duration formula

```
durationSeconds = 5 + (16 + filenameUtf8Bytes + payloadBytes) × 11 / 300
```

Where 16 = fixed header (12) + CRC (4). For a maximum 1024-byte payload with 64-byte filename: `5 + (16 + 64 + 1024) × 11 / 300 = 5 + 40.48 = 45.48 s`. WAV file size: 44 + 45.48 × 48000 × 2 = 4,366,124 bytes (under the 8 MiB decode input limit).

## Validation order (decoder)

1. Check file size ≤ 8 MiB.
2. Parse RIFF/WAVE header chunks; do not assume a fixed 44-byte header; skip bounded unknown chunks.
3. Verify format tag = 1, channels = 1, bit depth = 16, sample rate ∈ {44100, 48000}.
4. Verify audio duration ≤ 60 seconds.
5. Acquire carrier: scan for ≥3 seconds of continuous 2400 Hz (900 bit-periods = 144,000 samples at 48 kHz; 132,300 samples at 44.1 kHz).
6. Enter data-search mode: perform symbol alignment search — scan all `samplesPerBit` candidate offsets after the carrier end, validating each against the TGHO magic bytes (4 bytes × 11 bit-periods); the first offset that decodes `[0x54, 0x47, 0x48, 0x4F]` without a framing error establishes the symbol clock. If no candidate succeeds → sync-failure. Bounds must be checked before every correlation window.
7. Decode 8N2 bytes via `frameByte`; verify start bit = zero, stop bits = one strictly; any `'ambiguous'` classification or logic-zero stop bit = framing error.
8. Collect envelope bytes; verify minimum length before reading variable fields.
9. Validate magic, version, kind, Filename Length ≤ 64, Payload Length ≤ 1024.
10. Verify total available bytes ≥ 12 + Filename Length + Payload Length + 4 before reading.
11. For Kind=0: verify Filename Length = 0.
12. Consume all envelope bytes including the 4 CRC bytes before reporting success.
13. Recompute and verify CRC; mismatch = error, no payload returned.
14. For Kind=0: validate payload as UTF-8; invalid = error.
15. For Kind=1: recover raw filename bytes; derive sanitized download basename.

## Independence rule

Encoder and decoder must be tested independently of each other for signal properties. A shared mistake can produce a passing round-trip while generating an incorrect waveform. Use hand-derived fixtures and independently authored test vectors.
