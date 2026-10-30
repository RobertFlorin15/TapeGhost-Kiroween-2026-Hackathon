# Requirements Document

## Introduction

TapeGhost is a browser-only educational application that converts text or small binary files into FSK audio, exports the result as a standard WAV file, and recovers the original bytes with integrity checking. The user types a message (or drops a file), hears its encoded sound, inspects its bits, exports the WAV, imports it in a fresh session, and recovers the original data.

The application targets introductory computing students, teachers, and retro-computing enthusiasts. It demonstrates every stage of the encode/decode pipeline in an install-free, accessible interface with testable, transparent behavior.

TapeGhost uses KCS-derived 300-baud FSK modulation (1200 Hz = zero, 2400 Hz = one) with 8N2 character framing, combined with a custom application-layer envelope called the TGHO envelope. This envelope is TapeGhost's own design and is not compatible with arbitrary vintage tapes, CUTS, Acorn, or Tarbell formats.

The MVP does not support physical tape playback, noise tolerance, speed variation, error correction, or backend services.

---

## Glossary

- **Baud rate**: The number of symbols transmitted per second. TapeGhost uses 300 baud, meaning 300 bit-periods per second.
- **Carrier tone / Mark tone**: A continuous 2400 Hz (logic-one) tone transmitted for exactly 5 seconds by the MVP encoder before the first data byte. Used to establish synchronization on the receiving side.
- **CRC-32/ISO-HDLC**: A 32-bit cyclic redundancy check using the polynomial 0x04C11DB7, reflected input and output, initial value 0xFFFFFFFF, and final XOR 0xFFFFFFFF. The known-answer value for the ASCII string `123456789` is `0xCBF43926`. CRC detects accidental corruption; it does not correct errors, encrypt data, or establish authenticity.
- **FSK (Frequency-Shift Keying)**: A modulation scheme that encodes binary data as distinct audio frequencies. TapeGhost uses 1200 Hz for logic zero and 2400 Hz for logic one.
- **Framing (8N2)**: Serial character framing with 8 data bits, no parity bit, and 2 stop bits. Each character is preceded by 1 start bit (logic zero) for a total of 11 bit-periods per character.
- **KCS (Kansas City Standard)**: A 1976 tape storage standard described in the BYTE February 1976 symposium report. It specifies 300-baud FSK with 4 cycles of 1200 Hz per zero-bit and 8 cycles of 2400 Hz per one-bit. TapeGhost uses KCS-derived modulation; it is not claimed to be universally KCS-compliant or physically tape-compatible.
- **LSB-first**: Bit transmission order in which the least-significant bit of a byte is sent first. TapeGhost follows the KCS convention of LSB-first data transmission.
- **PCM (Pulse-Code Modulation)**: A method of digitally representing sampled audio. TapeGhost output uses signed 16-bit PCM at 48,000 Hz.
- **RIFF/WAVE**: The standard container format for uncompressed PCM audio on Windows and the web (format tag 1). Specified by Microsoft's Resource Interchange File Format documentation.
- **TGHO envelope**: TapeGhost's custom, openly documented application-layer framing, identified by the four-byte ASCII magic `TGHO`. It carries version, content kind, optional filename, payload bytes, and a CRC-32/ISO-HDLC integrity check. It is not part of the historical KCS standard.
- **UTF-8 byte length**: The number of bytes in the UTF-8 encoding of a string, which may exceed the JavaScript character count for multi-byte characters (e.g., Romanian diacritics, emoji). Payload size limits are enforced on byte length, not character count.

---

## Requirements

### Requirement 1: Text Payload Encoding

**User Story:** As a student, I want to type a UTF-8 text message and encode it to audio, so that I can hear and inspect a real cassette-era data signal.

#### Acceptance Criteria

1. THE Encoder SHALL accept UTF-8 text input with a payload UTF-8 byte length between 0 and 1024 bytes inclusive.
2. IF the UTF-8 byte length of the text input exceeds 1024 bytes, THEN THE Encoder SHALL display an error message identifying the actual byte count and SHALL NOT produce audio output.
3. THE Encoder SHALL enforce the 1024-byte limit using the UTF-8 byte length of the text, not the JavaScript character count.
4. THE Encoder SHALL accept a zero-byte (empty) text payload as a valid input and produce a TGHO envelope with Kind set to 0, Filename Length set to 0, Payload Length set to 0, and an empty payload body.
5. THE Encoder SHALL correctly encode UTF-8 multibyte characters, including Romanian diacritics (e.g., ă, â, î, ș, ț) and emoji, preserving the exact UTF-8 byte sequence in the envelope payload.
6. IF text input is provided, THEN THE Encoder SHALL set the Kind field of the TGHO envelope to 0 (UTF-8 text).
7. IF text input is provided, THEN THE Encoder SHALL set the Filename Length field of the TGHO envelope to 0.

---

### Requirement 2: Binary File Payload Encoding

**User Story:** As a developer, I want to encode an arbitrary binary file, so that I can verify the encoder handles non-text byte sequences including null bytes.

#### Acceptance Criteria

1. THE Encoder SHALL accept binary file payloads with a byte length between 0 and 1024 bytes inclusive.
2. IF a binary file payload exceeds 1024 bytes, THEN THE Encoder SHALL reject it and report an error indicating the actual byte count; the Encoder SHALL NOT produce audio output.
3. THE Encoder SHALL preserve every byte of a binary payload exactly, including null bytes (0x00) and bytes with value 0xFF, such that decoding the audio output yields a byte sequence identical to the input.
4. THE Encoder SHALL accept a filename associated with a binary file payload whose UTF-8 byte length is between 0 and 64 bytes inclusive; the Encoder SHALL store the raw UTF-8 bytes of the filename in the TGHO envelope Filename field without modification.
5. IF a binary file payload is provided with a filename, THEN THE Encoder SHALL set the Kind field of the TGHO envelope to 1 (binary file) and the Filename Length field to the UTF-8 byte length of the filename.
6. IF a binary file payload is provided without a filename, THEN THE Encoder SHALL set the Kind field of the TGHO envelope to 1 (binary file) and the Filename Length field to 0.
7. IF a filename's UTF-8 byte length exceeds 64 bytes, THEN THE Encoder SHALL reject it and report an error; the Encoder SHALL NOT produce audio output.

---

### Requirement 3: TGHO Envelope Serialization

**User Story:** As a developer, I want the encoder to produce a well-formed TGHO envelope, so that the decoder can reliably parse and verify the transmitted data.

#### Acceptance Criteria

1. THE Encoder SHALL produce a TGHO envelope beginning with the four-byte ASCII magic sequence `TGHO` (0x54, 0x47, 0x48, 0x4F).
2. THE Encoder SHALL set the Version byte of the envelope to 1, followed immediately by the Kind byte, which SHALL be set to a value that identifies the envelope content type and SHALL be encoded as an unsigned 8-bit integer occupying exactly 1 byte at offset 5.
3. THE Encoder SHALL encode the Filename Length field as an unsigned 16-bit little-endian integer representing the exact number of UTF-8 encoded bytes in the Filename field, placed immediately after the Kind byte.
4. THE Encoder SHALL encode the Payload Length field as an unsigned 32-bit little-endian integer equal to the exact byte length of the payload, placed immediately after the Filename Length field.
5. THE Encoder SHALL place the Filename bytes immediately after the Payload Length field, with a byte count equal to the Filename Length value, encoded as UTF-8.
6. THE Encoder SHALL place the Payload bytes immediately after the Filename field, with a byte count equal to the Payload Length value.
7. THE Encoder SHALL compute the CRC-32/ISO-HDLC checksum over all envelope bytes preceding the CRC field (Magic + Version + Kind + Filename Length + Payload Length + Filename + Payload) and encode the result as a 4-byte little-endian integer placed immediately after the Payload field.
8. WHEN the CRC_Module receives the ASCII byte sequence `123456789` as input, THE CRC_Module SHALL produce the checksum value `0xCBF43926`.
9. IF the Filename Length field value is 0, THEN THE Encoder SHALL omit the Filename field bytes and place the Payload field immediately after the Payload Length field.

**Correctness Property — Envelope Round Trip:**
FOR ALL valid TGHO envelope inputs, parsing the serialized envelope SHALL produce a structure equal to the original (round-trip property).

---

### Requirement 4: FSK Signal Generation

**User Story:** As a student, I want the audio to use authentic KCS-derived tones, so that I can relate the signal to the historical 1976 standard.

#### Acceptance Criteria

1. THE Encoder SHALL represent a logic-zero bit as exactly 4 complete cycles of a 1200 Hz sine wave.
2. THE Encoder SHALL represent a logic-one bit as exactly 8 complete cycles of a 2400 Hz sine wave.
3. THE Encoder SHALL use a sample rate of 48,000 Hz for all generated audio; each logic-zero bit SHALL occupy exactly 160 samples and each logic-one bit SHALL occupy exactly 160 samples.
4. THE Encoder SHALL transmit data bits in LSB-first order within each 8N2 character frame.
5. THE Encoder SHALL prefix each character with 1 start bit (logic zero) and follow the 8 data bits with exactly 2 stop bits (logic one), for 11 bit-periods per character.
6. THE Encoder SHALL precede all data bytes with a carrier tone of exactly 5 seconds (240,000 samples at 48,000 Hz) of continuous 2400 Hz (mark/logic-one) signal.
7. THE Encoder SHALL generate all tones as sine waves with amplitude 0.75 of signed 16-bit full scale (0.75 × 32767 ≈ 24575 peak).
8. THE Encoder SHALL maintain a continuous, uninterrupted oscillator phase across all bit boundaries, character boundaries, and the carrier-to-first-character transition, starting at 0 radians at the beginning of the carrier; no phase reset SHALL occur between any two consecutive bit-periods.
9. WHEN given identical input and options, THE Encoder SHALL produce bit-for-bit identical WAV output.

**Independent Signal Verification (not a round-trip test):**
THE Signal_Verifier SHALL independently confirm, using hand-derived expected values, that the encoded byte 0x00 produces the bit sequence (start=0, d0–d7=00000000 LSB-first, stop=1, stop=1) across 11 bit-periods of 160 samples each (1760 samples total). THE Signal_Verifier SHALL confirm that byte 0xFF produces the bit sequence (start=0, d0–d7=11111111, stop=1, stop=1). THE Signal_Verifier SHALL confirm that byte 0x01 produces the bit sequence (start=0, d0=1, d1–d7=0000000, stop=1, stop=1). THE Signal_Verifier SHALL confirm that byte 0xA5 produces the bit sequence (start=0, d0=1, d1=0, d2=1, d3=0, d4=0, d5=1, d6=0, d7=1, stop=1, stop=1). Each verified byte SHALL occupy exactly 1760 samples.

10. THE Decoder SHALL accept a carrier tone of at least 3 seconds of continuous 2400 Hz signal before data; the Decoder SHALL NOT require the carrier to be exactly 5 seconds in order to successfully decode.

---

### Requirement 5: WAV Output Format

**User Story:** As a user, I want to export the audio as a standard WAV file, so that I can play it in a media player and import it back into TapeGhost.

#### Acceptance Criteria

1. THE Encoder SHALL produce a RIFF/WAVE file with format tag 1 (PCM), mono (1 channel), signed 16-bit samples, and a sample rate of 48,000 Hz.
2. THE Encoder SHALL write all multi-byte WAV header fields in little-endian byte order per the RIFF specification.
3. THE Encoder SHALL set the data subchunk size field to `sample_count × 2` bytes and the RIFF chunk size field to `36 + (sample_count × 2)` bytes for all outputs, including outputs produced from an empty payload.
4. THE WAV_Output SHALL not include timestamps, metadata chunks, or dither of any kind.
5. THE WAV_Output SHALL be verified as valid PCM WAV by running `ffprobe -v error -show_streams` on the output file and confirming that the reported codec is `pcm_s16le`, channels is `1`, and sample_rate is `48000`.

---

### Requirement 6: Payload Decoding

**User Story:** As a student, I want to import an exported WAV file in a fresh page session and recover the original message, so that I can verify the complete round trip.

#### Acceptance Criteria

1. THE Decoder SHALL accept WAV files conforming to the supported input profile and recover the original payload bytes without modification, such that the recovered byte sequence is identical to the sequence passed to the Encoder.
2. THE Decoder SHALL support mono PCM16 WAV files at 44,100 Hz and 48,000 Hz sample rates.
3. THE Decoder SHALL reject WAV files exceeding 8 MiB in size and report an error identifying the file size.
4. THE Decoder SHALL reject WAV files with audio duration exceeding 60 seconds and report an error identifying the duration.
5. THE Decoder SHALL reject WAV files with compressed audio (format tag other than 1), stereo or multi-channel audio, bit depths other than 16-bit, and sample rates other than 44,100 or 48,000 Hz, reporting a specific error for each rejection reason.
6. IF a WAV file contains between 0 and 1 second of silence before the carrier tone, THEN THE Decoder SHALL recover the payload bytes identically to a file with no leading silence.
7. IF a WAV file's audio amplitude is scaled by a constant gain factor between 0.25 and 1.0 relative to the Encoder's output, THEN THE Decoder SHALL recover the payload bytes identically to an unscaled file.
8. THE Decoder SHALL parse WAV chunk sizes and skip bounded unknown chunks per the RIFF specification; the Decoder SHALL NOT assume a fixed 44-byte header.
9. THE Decoder SHALL scan the audio samples for the carrier tone, locate the first start bit pattern as defined by the encoding framing, and sample each subsequent character frame at the encoded bit rate to reconstruct payload bytes.
10. IF the Decoder cannot locate a carrier tone or a valid start bit pattern within the audio, THEN THE Decoder SHALL report an error indicating that no decodable signal was found and SHALL NOT return a partial payload.
11. THE Decoder SHALL consume the complete envelope — all fixed header fields, Filename bytes (Filename Length bytes), Payload bytes (Payload Length bytes), and the 4 CRC bytes — before reporting a successful decode result. THE Decoder SHALL NOT report success if the bit stream ends before all envelope bytes including the trailing CRC have been received.
12. IF the decoded envelope has Kind set to 0 (UTF-8 text), THEN THE Decoder SHALL verify that the Filename Length field equals 0; IF Filename Length is non-zero in a Kind=0 envelope, THEN THE Decoder SHALL report a format error.

**Correctness Property — Encode/Decode Round Trip:**
FOR ALL valid payloads (kind, filename, byte sequence within limits), encoding the payload to WAV and then decoding the WAV SHALL produce a payload byte sequence identical to the original input.

---

### Requirement 7: TGHO Envelope Parsing

**User Story:** As a developer, I want the decoder to parse and validate the TGHO envelope, so that data corruption is detected before the payload is presented to the user.

#### Acceptance Criteria

1. THE Decoder SHALL verify that the first four bytes of the decoded envelope equal the ASCII sequence `TGHO`; IF the magic bytes do not match, THEN THE Decoder SHALL reject the envelope and report a format error.
2. THE Decoder SHALL verify that the Version byte equals 1; IF the version is unsupported, THEN THE Decoder SHALL reject the envelope and report an unsupported version error.
3. THE Decoder SHALL verify that the Kind byte is 0 or 1; IF the Kind byte is any other value, THEN THE Decoder SHALL reject the envelope and report an unknown kind error.
4. THE Decoder SHALL verify that the declared Filename Length does not exceed 64 bytes; IF it does, THEN THE Decoder SHALL reject the envelope and report a filename length error.
5. THE Decoder SHALL verify that the declared Payload Length does not exceed 1024 bytes; IF it does, THEN THE Decoder SHALL reject the envelope and report a payload length error.
6. THE Decoder SHALL verify that the total decoded byte count is at least the sum of the fixed header size, the declared Filename Length, the declared Payload Length, and the CRC field size before reading any variable-length field; IF the decoded byte count is less than this sum, THEN THE Decoder SHALL report a truncation error and SHALL NOT attempt to read beyond the available bytes.
7. THE Decoder SHALL recompute the CRC-32/ISO-HDLC over all envelope bytes preceding the CRC field; IF the computed value does not match the stored CRC, THEN THE Decoder SHALL report a CRC mismatch error and SHALL NOT present the payload to the user as valid.
8. WHEN the envelope is valid and the Kind is 0, THE Decoder SHALL present the payload as UTF-8 text and SHALL NOT interpret it as HTML.
9. IF the envelope is valid, the Kind is 0, and the payload bytes are not valid UTF-8, THEN THE Decoder SHALL reject the payload and report a UTF-8 encoding error.
10. WHEN the envelope is valid and the Kind is 1, THE Decoder SHALL recover the raw Filename bytes from the envelope unchanged. THE Decoder SHALL derive a safe suggested download basename from the recovered filename bytes by: (a) attempting to decode the bytes as UTF-8; (b) removing any path separator characters (`/`, `\`), leading dot sequences (`..`), null bytes, and control characters (U+0000–U+001F, U+007F); (c) truncating to a maximum of 64 code points; and (d) if the result is empty after sanitization, using the fallback name `recovered_file`. The Decoder SHALL NOT reject the envelope or report an error based on the content of the Filename bytes alone; filename sanitization failures SHALL only affect the suggested download name, not the recovered payload or metadata.

---

### Requirement 8: Graceful Error Handling

**User Story:** As a user, I want clear error messages when input is invalid or decoding fails, so that I understand what went wrong without the application crashing.

#### Acceptance Criteria

1. IF a WAV file contains silence with no detectable carrier tone, THEN THE Decoder SHALL report a "no carrier detected" error and SHALL NOT report success.
2. THE Decoder SHALL scan incoming bit-periods for a carrier acquisition candidate defined as at least 3 seconds of continuous 2400 Hz (logic-one) signal; WHEN such a candidate is detected, THE Decoder SHALL enter data-search mode and look for the first valid start bit (a logic-zero bit-period following at least one logic-one stop/mark period); IF no valid start bit is found within 10,000 bit-periods after carrier acquisition, THEN THE Decoder SHALL report a synchronization failure and SHALL NOT attempt further decoding.
3. WHEN the Decoder is processing a data byte frame, IF any bit-period that is expected to be a stop bit (logic one) is detected as a logic zero, THEN THE Decoder SHALL treat that frame as a framing error and SHALL report a framing error for the entire decoding attempt; partial payload bytes from a frame that contained a framing error SHALL NOT be returned to the caller.
4. IF the CRC of the decoded envelope does not match the stored CRC, THEN THE Decoder SHALL report a CRC mismatch and SHALL NOT silently return the payload.
5. THE Application SHALL NOT crash, throw unhandled exceptions, or enter an inconsistent state when any supported error condition is triggered.
6. THE Application SHALL report a distinct, human-readable error message for each rejection reason: oversized file, unsupported WAV profile, no carrier, sync failure, framing error, magic mismatch, unsupported version, unknown kind, length overflow, truncation, and CRC mismatch.
7. IF a framing error or a CRC mismatch is reported, THEN THE Application SHALL distinguish between the two conditions in its status message.

---

### Requirement 9: User Interface — Encoding Flow

**User Story:** As a student, I want a clear interface to enter my message, see the byte count and estimated duration, and export the audio, so that I can understand what I am encoding before I produce any output.

#### Acceptance Criteria

1. THE UI SHALL provide a text input area that accepts UTF-8 text and a file picker that accepts binary files up to 1024 bytes.
2. WHEN the user modifies the text input, THE UI SHALL update the displayed UTF-8 byte count within 200 milliseconds of the last keystroke.
3. WHEN the user modifies the text input or selects a binary file, THE UI SHALL update the estimated audio duration within 200 milliseconds; the estimate SHALL be computed as: `durationSeconds = 5 + (16 + filenameUtf8Bytes + payloadBytes) × 11 / 300`, where 16 is the fixed envelope header and CRC byte count, filenameUtf8Bytes is 0 for text input, and the result is expressed in seconds rounded to one decimal place.
4. WHEN the byte count exceeds 1024 bytes, THE UI SHALL display a visible warning indicating the limit and the exact byte count, and the encode button SHALL be disabled.
5. THE UI SHALL provide a button labeled "Encode" that triggers encoding; encoding SHALL NOT begin without explicit user activation of that button.
6. WHEN encoding is complete, THE UI SHALL provide a download link or button that exports the WAV file.
7. THE UI SHALL NOT transmit the payload, WAV audio, or any user data to any server.
8. WHEN encoding is complete, THE UI SHALL provide a user-triggered play/stop control for the newly encoded audio; playback SHALL NOT begin automatically, and the control SHALL be distinct from the WAV file download action.

---

### Requirement 10: User Interface — Decoding Flow

**User Story:** As a student, I want to import a WAV file and see the recovered message with its integrity status, so that I can confirm the complete round trip.

#### Acceptance Criteria

1. THE UI SHALL provide a WAV file import control that accepts only files with a `.wav` extension; IF the user selects a file without a `.wav` extension, THEN THE UI SHALL display an error indicating the file type is not supported and SHALL NOT begin decoding.
2. WHEN a WAV file is imported, THE UI SHALL display a progress indicator that remains visible and updates continuously until decoding completes or fails.
3. WHEN decoding succeeds, THE UI SHALL display the recovered text payload or offer the recovered binary file for download, labeled with both a success status and a confirmation that CRC verification passed.
4. IF decoding fails for any reason, THEN THE UI SHALL display an error message identifying the cause of failure and SHALL NOT display any portion of the payload as successfully recovered.
5. THE UI SHALL provide a user-triggered play/stop control for audio playback; this control SHALL be available for both imported WAV files and for newly encoded audio that has not yet been exported.
6. THE UI SHALL NOT begin audio playback of any WAV file without an explicit user action.
7. WHEN the user triggers the clear action, THE UI SHALL remove all imported files, decoded output, and status messages, returning every input field to its empty default value.

---

### Requirement 11: Waveform and Bit Inspection

**User Story:** As a student, I want to see the waveform and the individual bit values of my encoded signal, so that I can relate the audio to the underlying data.

#### Acceptance Criteria

1. THE UI SHALL render a waveform of the encoded audio on a Canvas element, where the horizontal axis represents time and the vertical axis represents signal amplitude, spanning the full duration of the encoded audio.
2. WHEN the user selects a region of the waveform by clicking and dragging on the Canvas, THE UI SHALL display the individual bit values and their corresponding tone labels (0 = 1200 Hz, 1 = 2400 Hz) for each bit whose time range falls within the selected region.
3. IF no region is selected, THEN THE UI SHALL display no bit values and SHALL show a prompt indicating that a waveform region must be selected to inspect bits.
4. THE Waveform_Display SHALL provide a text alternative or descriptive label that identifies the encoding scheme, the total number of bits, and the tone frequency assigned to each bit value (0 = 1200 Hz, 1 = 2400 Hz).
5. WHERE `prefers-reduced-motion` is enabled, THE Waveform_Display SHALL omit animated transitions when rendering or updating the waveform display.
6. THE UI SHALL provide a keyboard-operable control (such as a pair of labeled numeric inputs or a range slider pair) that allows the user to set the start and end positions of the bit-inspection region without using the canvas drag interaction; the keyboard control SHALL produce the same bit-inspection output as the canvas drag selection for the same start and end positions.

---

### Requirement 12: Accessibility

**User Story:** As a student using assistive technology, I want to use TapeGhost with only a keyboard and a screen reader, so that essential understanding of the encode/decode pipeline does not require hearing or color vision.

#### Acceptance Criteria

1. THE UI SHALL use semantic HTML elements (button, input, label, status, alert roles) for all interactive controls and status regions.
2. THE UI SHALL provide a visible focus indicator on every focusable element where the indicator has a minimum area of a 2 CSS pixel perimeter around the component and meets a 3:1 contrast ratio against the adjacent background color.
3. THE UI SHALL present all focusable elements in a tab order that follows the logical top-to-bottom, left-to-right reading sequence of the page; no focusable element shall be skipped or unreachable via the Tab key.
4. THE UI SHALL be fully operable using only a keyboard; each individual action — encoding, decoding, downloading, and playback — SHALL be reachable and activatable via Tab and Enter or Space without requiring a pointing device.
5. THE UI SHALL provide text-based status messages for all decoding outcomes (success with CRC verification result, or a specific named error type) announced by screen readers via ARIA live regions set to `polite` politeness for success outcomes and `assertive` for error outcomes.
6. THE UI SHALL ensure that all information conveyed by color (e.g., success/error state) is also conveyed by a visible text label or icon with an accessible text alternative.
7. THE UI SHALL remain usable at a minimum viewport width of 360 px without horizontal scrolling; all interactive controls, status messages, and instructional text SHALL remain visible and operable at that width.
8. THE UI SHALL NOT require audio playback for any essential function; all core encode/decode and error-reporting behavior SHALL be accessible without sound.
9. THE UI SHALL provide a text alternative for each waveform and bit-inspection visualization that states the bit sequence, signal levels, and time-axis scale represented, so that the educational content is accessible without visual rendering.
10. WHEN the `prefers-reduced-motion` media query is active, THE UI SHALL suppress all CSS and JavaScript-driven animations.

---

### Requirement 13: Performance Targets

**User Story:** As a user, I want encoding and decoding of the maximum payload to complete quickly, so that the tool remains responsive during interactive use.

#### Acceptance Criteria

1. THE Encoder SHALL target completing encoding of a 1024-byte payload within 2 seconds wall-clock time, measured from encode invocation to output buffer availability; this target is pending measurement on a recorded reference device (device model, OS version, and browser version to be documented in `docs/KIRO_USAGE.md` before the target is claimed). A recorded design decision is required before the target value may be changed.
2. THE Decoder SHALL target completing decoding of a maximum-payload WAV file within 2 seconds wall-clock time, measured from decode invocation to payload-bytes-available; this target is pending measurement on the same reference device documented for criterion 1. A recorded design decision is required before the target value may be changed.
3. THE Codec SHALL own no more than 64 MiB of typed-array and ArrayBuffer storage allocated for codec-internal working buffers (excluding the input WAV bytes and the output audio samples) when processing the maximum allowed payload; this budget SHALL be verified by instrumenting codec allocations in tests, not by relying on browser memory API attribution.
4. WHEN the caller posts a cancellation message to the codec worker, THE Worker SHALL post a cancellation-confirmed message back to the caller within 250 ms of the caller's post timestamp (not the worker's receipt timestamp); the implementation SHALL use a polling-based or checkpointed approach within the codec loop so that a blocked message queue cannot conceal a worker that has stopped processing but not yet acknowledged cancellation.
5. THE Application SHALL measure and record encode and decode wall-clock durations on the reference environment defined in criterion 1 before publishing performance claims; IF any measured duration exceeds the threshold defined in criteria 1 or 2, THEN THE Application SHALL update the published target values to match the measured results before the next release.

---

### Requirement 14: Codec Worker Isolation

**User Story:** As a developer, I want the codec to run in a Web Worker, so that the main thread remains responsive during encoding and decoding.

#### Acceptance Criteria

1. THE Codec_Worker SHALL execute all FSK encoding and decoding computation in a dedicated Web Worker thread, not on the browser main thread.
2. THE Codec_Worker SHALL accept encode and decode requests via message passing and return results or progress updates via message posting.
3. THE Codec_Worker SHALL expose a cancellation interface; WHEN the caller posts a cancel message, THE Codec_Worker SHALL post a cancellation-confirmed message to the caller within 250 ms of the caller's post timestamp, using a codec-loop checkpoint approach that does not rely solely on the worker's message-receive event timing.
4. THE DSP_Module SHALL be importable and executable in a Node.js test process without any browser globals (window, document, AudioContext, or Canvas).

---

### Requirement 15: Testing — Signal Independence

**User Story:** As a developer, I want independent tests for historical signal properties, so that a shared mistake in the encoder and decoder cannot conceal an incorrectly implemented waveform.

#### Acceptance Criteria

1. THE Test_Suite SHALL include tests that verify the FSK encoding of bytes 0x00, 0xFF, 0x01, and 0xA5 by comparing encoder output against expected bit sequences and per-symbol sample counts pre-computed from the FSK specification without executing the encoder or decoder.
2. THE Test_Suite SHALL verify that the carrier tone preceding data has a duration of at least 240,000 samples at 48,000 Hz by measuring the sample count of the carrier region independently of the decoder.
3. THE Test_Suite SHALL verify the RIFF/WAVE header fields using an independent WAV header parser, confirming: format tag equals PCM (0x0001), channel count equals 1, sample rate equals 48,000 Hz, bit depth equals 16 bits, and chunk sizes consistent with the actual file size; IF any field does not match its expected value, THEN THE Test_Suite SHALL report which field failed and its actual value.
4. THE Test_Suite SHALL verify the CRC-32/ISO-HDLC known-answer: the checksum of ASCII `123456789` SHALL equal `0xCBF43926`.
5. THE Test_Suite SHALL verify that each FSK symbol spans exactly 160 samples at 48,000 Hz by inspecting raw encoder output independently of the decoder.
6. THE Test_Suite SHALL verify that logic-zero symbols produce a dominant frequency of 1200 Hz (±5 Hz tolerance) and that logic-one symbols produce a dominant frequency of 2400 Hz (±5 Hz tolerance) by computing the dominant frequency of 160-sample symbol windows from raw encoder output independently of the decoder; verification SHALL confirm both the 4-cycle-per-symbol structure for 1200 Hz and the 8-cycle-per-symbol structure for 2400 Hz.
7. THE Test_Suite SHALL include decoder tests at both 44,100 Hz and 48,000 Hz sample rates using clean synthetic fixtures, verifying: (a) a fixture with no leading silence (carrier begins at sample 0); (b) a fixture with exactly 1 second of leading silence (44,100 or 48,000 zero-valued samples before the carrier); and (c) a fixture with the carrier starting at an arbitrary sample offset between 0 and the respective 1-second sample count. Each fixture SHALL use the defined initial phase of 0 radians and SHALL produce a recovered payload identical to the encoded input.
8. THE Test_Suite SHALL include at least one independently authored fixture whose expected output was derived without running the TapeGhost encoder; the fixture file SHALL carry a provenance comment identifying the derivation method and author (human or tool), and the test SHALL assert the exact recovered payload bytes.
9. THE Test_Suite SHALL include explicit encoding and round-trip cases for: payload lengths 0, 1, 255, 256, 1023, and 1024 bytes; a text payload consisting of a single Romanian diacritic character (e.g., "ă", UTF-8 bytes 0xC3 0x84); and a text payload consisting of a multi-byte emoji (e.g., U+1F4BE "💾", UTF-8 bytes 0xF0 0x9F 0x92 0xBE). Each case SHALL assert that the decoded payload is byte-for-byte identical to the encoded input.

---

### Requirement 16: Testing — Property-Based Tests

**User Story:** As a developer, I want property-based tests with fixed seeds for the codec, so that edge cases involving arbitrary byte sequences are discovered systematically and results are reproducible.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a seeded property-based test verifying that encoding any valid payload, defined as an arbitrary byte sequence of length 0 to 1024 bytes inclusive, and decoding the result returns the original byte sequence (encode/decode round trip), generating at least 100 samples per run.
2. THE Test_Suite SHALL include a seeded property-based test verifying that parsing any serialized TGHO envelope returns a structure where all parsed fields are equal to the corresponding fields of the original envelope before serialization (envelope round-trip property), generating at least 100 samples per run.
3. THE Test_Suite SHALL include a property-based test with a fixed seed exercising at least 100 short byte-array cases of length 1 to 16 bytes and at least one explicit maximum-size case of exactly 1024 bytes per run.
4. THE Test_Suite SHALL maintain envelope/framing property tests and audio/WAV property tests in separate test files so that each file can be executed independently without requiring the other file to run.
5. THE Test_Suite SHALL define the fast-check seed as a numeric literal constant in test source code so that test results are reproducible across runs without external configuration.

---

### Requirement 17: Testing — Rejection and Error Paths

**User Story:** As a developer, I want tests that confirm invalid inputs are rejected without crashes or false success, so that users never receive a corrupted or forged payload presented as valid.

#### Acceptance Criteria

1. WHEN the Test_Suite executes the CRC-mismatch test, THE Test_Suite SHALL: (a) serialize a valid TGHO envelope; (b) mutate exactly 1 payload byte at a fixed offset in the serialized envelope bytes while retaining the original CRC field value unchanged; (c) modulate the modified envelope bytes into otherwise valid audio using the standard encoder path; (d) submit the resulting WAV to the decoder; and (e) verify that the decoder returns a CRC mismatch error and returns no decoded payload. THE Test_Suite SHALL also include a parser-level CRC-mismatch test that submits the modified envelope bytes directly to the envelope parser, bypassing the audio path, and verifies the same error.
2. WHEN the Test_Suite executes the unsupported-profile tests, THE Test_Suite SHALL attempt to decode a WAV file for each of the following unsupported profiles: stereo (2 channels), non-PCM (format tag ≠ 1), unsupported sample rate (e.g., 22,050 Hz), and unsupported bit depth (e.g., 8-bit). For each attempt, THE Test_Suite SHALL verify that the decoder returns an error in the `unsupported-wav-profile` error category and that the error detail identifies the specific mismatched parameter (e.g., "unsupported sample rate: 22050") so that errors for different profiles are distinguishable by their detail, not by separate error types.
3. WHEN the Test_Suite executes the silence-detection test, THE Test_Suite SHALL attempt to decode a WAV file in which every audio sample has a value of zero and verify that the decoder returns a no-carrier-detected error and returns no decoded payload.
4. WHEN the Test_Suite executes the truncation tests, THE Test_Suite SHALL submit envelopes with at least 1 byte removed immediately after the Payload Length field and verify that the decoder returns a truncation error and returns no decoded payload.
5. WHEN the Test_Suite executes the unsupported-version tests, THE Test_Suite SHALL attempt to decode envelopes with Version field values of 0, 2, and 255 and verify that each attempt returns an unsupported-version error and returns no decoded payload.
6. WHEN the Test_Suite executes the Payload Length overflow test, THE Test_Suite SHALL submit an envelope with a Payload Length field value of 1025 and verify that the decoder returns a length-overflow error and returns no decoded payload.
7. WHEN the Test_Suite executes the maximum valid Payload Length test, THE Test_Suite SHALL submit a well-formed envelope with a Payload Length field value of 1024 and verify that the decoder accepts it without returning an error.

---

### Requirement 18: Build, CI, and Static Deployment

**User Story:** As a developer, I want the full test suite and production build to pass in CI, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE Build_System SHALL produce a static bundle by emitting at least one `.html` file and at least one `.js` file into the build output directory, with zero TypeScript strict-mode errors and zero ESLint errors reported during the build.
2. IF any Vitest test fails, THEN THE CI_Pipeline SHALL halt and exit with a non-zero exit code without proceeding to the build step.
3. THE Test_Suite SHALL include Playwright end-to-end tests covering: (a) encoding a text payload of 1–256 UTF-8 bytes, downloading the exported WAV file, opening a fresh browser page session with no prior state, importing the downloaded WAV file, and asserting the recovered text is a byte-for-byte match of the original input; and (b) encoding a payload, serializing its envelope, mutating one payload byte while retaining the original CRC, modulating the mutated envelope into audio, importing the resulting WAV in the browser, and asserting the UI displays a CRC mismatch error message.
4. WHEN Playwright tests complete, THE Test_Suite SHALL have executed against both Chromium and Firefox and SHALL write the detected browser name and version for each to a file in the CI job's output artifacts.
5. THE Application SHALL be deployable as a static site (no server-side logic); all encoding, decoding, and integrity checking SHALL execute in the browser.
6. WHILE the device has no network access after initial page load, THE Application SHALL complete encoding, decoding, and integrity-checking operations without errors and without issuing any external network requests.

---

## Out of Scope (MVP)

The following capabilities are explicitly excluded from the MVP and must not be implemented or claimed:

- **Physical tape playback tolerance**: Noise, wow, flutter, speed variation, and resampling artifact correction are deferred to a future release.
- **CUTS / Acorn / Tarbell format compatibility**: TapeGhost uses KCS-derived modulation with its own TGHO envelope. Interoperability with Acorn CUTS, Tarbell, or other vintage tape formats is out of scope and must not be claimed.
- **Reed-Solomon or any error correction**: CRC-32/ISO-HDLC provides error detection only. No error correction code is part of the MVP.
- **Backend services**: No server, database, authentication, login, or network transmission of payload data.
- **Multi-channel or high-sample-rate audio input**: Only mono PCM16 WAV at 44,100 Hz or 48,000 Hz is supported for decoding input.
- **Lossy audio support**: MP3, AAC, OGG, and other compressed formats are out of scope.
- **Cross-engine WAV byte identity**: Identical WAV output is required only on the tested runtime; cross-engine byte identity must be verified empirically before being claimed.
