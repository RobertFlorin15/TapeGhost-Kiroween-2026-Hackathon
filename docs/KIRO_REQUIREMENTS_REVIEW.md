# Requirements review handoff

Reviewed by the assisting agent on 2026-10-30. The owner reports Kiro generated the requirements; the requirements file and feature/requirements-first configuration are present. No Kiro execution logs were inspected. This review does not modify the native spec or approve it on the owner's behalf.

Paste the following into the existing Kiro spec conversation:

```text
Before proceeding to design, revise .kiro/specs/tapeghost-mvp/requirements.md
against SKILL.md and docs/PROJECT_PLAN.md. Address these review findings:

1. Req 5.3: Remove the zero-size exception. Empty payloads still produce the
   envelope, CRC, and carrier. For the specified minimal WAV header, dataSize is
   sampleCount * 2 and riffSize is 36 + dataSize, even for zero audio samples.

2. Req 4.6 and 9.3: Freeze the MVP encoder carrier at exactly 5 seconds; use
   durationSeconds = 5 + (16 + filenameUtf8Bytes + payloadBytes) * 11 / 300.
   Apply the same estimator to both text and file input. The 16 bytes include
   the fixed header and CRC. Keep the decoder's accepted carrier policy explicit.

3. Req 2.4 and 7.10: Preserve valid UTF-8 filename metadata through the codec.
   Do not reject all non-ASCII filenames after accepting them for encoding.
   Specify a separate safe suggested download basename, with fallback for an
   empty/unsafe name, without changing the recovered raw payload or metadata.
   Replace "proprietary" with "custom, openly documented" for the envelope.

4. Req 6.11: Decode the complete bounded envelope, including its four CRC bytes,
   before reporting success. Enforce zero filename length for text envelopes.
   Req 8.3: Fail on any invalid start/stop framing within the selected data block;
   remove the unexplained 10% allowance. Distinguish acquisition candidates from
   accepted data frames and define bounded synchronization failure behavior.

5. Req 17.1 and 18.3: For a deterministic CRC-mismatch test, mutate a payload byte
   in a serialized envelope, retain its original CRC, then modulate that modified
   envelope into otherwise valid audio. Random WAV sample damage may be harmless
   or cause synchronization/framing failure; it cannot guarantee a CRC mismatch.
   Keep parser-level and full WAV-path tests distinct. For unsupported profiles,
   use stable error categories plus details (e.g. unsupported sample rate with
   the observed rate), not a separate error type for every numeric rate.

6. Req 11 and 12: Add a keyboard-operable bit/byte selection control equivalent
   to canvas dragging. Req 9/10: Explicitly allow play/stop of newly encoded audio,
   without requiring export and re-import first. Keep playback user-initiated.

7. Req 13/14: Use a concrete recorded reference device/OS/browser for benchmarks.
   Budget codec-owned typed-array/ArrayBuffer storage separately from observed
   total heap; do not require precise codec attribution from a browser memory API.
   Measure cancellation from the caller's request, not only worker receipt, and
   require an approach that cannot hide a blocked worker message queue. Treat
   two-second targets as targets pending measurement; changes require a recorded
   design decision, not an automatic rewrite of requirements after a failure.

8. Req 15: Assert the actual 1200/2400 Hz frequencies and 4/8 cycles per symbol,
   not just their separation. Add explicit clean-audio initial-phase and arbitrary
   leading-silence sample-offset cases at both supported rates, an independently
   authored fixture with provenance, and the planned boundary/Unicode cases.
   Req 18: The recovery E2E must import the downloaded WAV in a fresh page session.

Summarize the changed criteria and any remaining questions in Romanian, with
repository documents in English. Update SKILL.md progress and create or update
docs/KIRO_USAGE.md using only observed actions. Request review of the revised
requirements before proceeding through the native design/task stages. Do not
implement application code yet. Preserve .gitignore and keep .kiro/ tracked.
```

After requirements approval, Kiro should produce `design.md` with the exact wire
contract, decoder synchronization, error model, worker protocol, and validation
strategy; then `tasks.md` with the M1–M5 gates. Before M1 implementation, complete
the steering documents and the version-appropriate hook plan from the first prompt.
