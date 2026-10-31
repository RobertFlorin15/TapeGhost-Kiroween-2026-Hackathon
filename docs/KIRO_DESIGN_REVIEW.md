# Design review handoff — 2026-10-31

Reviewer: assisting agent. Scope: the 1,229-line initial `design.md`, the six
steering files, and the revised requirements. Status: revisions needed before
design approval. No application implementation or application tests exist yet.

## Findings and evidence

1. **Cancellation cannot interrupt the proposed synchronous worker loop.** The
   message handler that sets `cancelled` cannot run until the loop returns.
   Checking that same local flag once per byte does not fix this. The design
   needs actual task-queue yielding and per-request cancellation state, including
   carrier generation/search, rather than a guarantee based on byte processing
   speed. See [JavaScript run-to-completion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model#run-to-completion).

2. **Symbol timing is never acquired.** Stage 2 keeps windows on the file-origin
   sample grid; leading silence can put each window across two different bits.
   A standalone Python reproduction of the described quadrature classification,
   start search, and 8N2 sampling failed to recover `TGHO` for **26/160** sample
   offsets at 48 kHz and **23/147** offsets at 44.1 kHz. Example failing offsets:
   67 samples and 62 samples respectively. This diagnostic used clean PCM16 tones,
   phase zero, ratio threshold 1.5, two mark periods before four framed magic bytes,
   and two marks after them. It isolated the post-acquisition algorithm; it did
   not implement/test the application or its full carrier acquisition. The
   calculation is an assisting-agent review experiment, not Kiro evidence.

3. **44.1 kHz carrier arithmetic is wrong.** Three seconds is 900 bit periods at
   both sample rates. At 44.1 kHz that is 132,300 samples, not 882 periods or
   129,654 samples. Independently recalculated maximum output: 2,183,040 samples
   and 4,366,124 WAV bytes. The design's 2,182,560-sample total is incorrect.

4. **Parsing lacks required bounds checks before reads.** Envelope fields are
   accessed before checking a minimum header length. WAV traversal does not
   explicitly bound all known chunks, reject partial PCM samples, or guard all
   reads by the RIFF extent. The decoder frame/search loops lack end-of-input
   checks. These gaps can turn malformed input into exceptions or fabricated bits.

5. **Property domains contradict UTF-8 validation.** Property 3 demands that any
   short byte sequence succeeds as Kind=0 text. For example, `FF` is invalid
   UTF-8, confirmed with Python's strict decoder. Arbitrary byte properties must
   use binary Kind=1; text properties must generate valid UTF-8. The other
   round-trip properties must use the same valid-input constraints.

6. **Buffer ownership is incomplete.** Transferring imported WAV data detaches
   the sender's ArrayBuffer; `decodeAudioData` also detaches its input. Preserve
   canonical bytes or a File/Blob and use explicit copies for these consumers.
   See the [Web Audio decodeAudioData algorithm](https://www.w3.org/TR/webaudio-1.0/#dom-baseaudiocontext-decodeaudiodata).

7. **The interfaces and the prose disagree.** `generateBit` allocates a new array
   while the performance section says it writes directly into a preallocated
   destination. Error tags are added only in later prose, and all unexpected
   exceptions are mislabeled as unsupported WAV. The final document should
   contain one coherent contract, with validation before allocation.

## Exact prompt for the existing Kiro spec conversation

```text
Read docs/KIRO_DESIGN_REVIEW.md and revise the existing design in place.
Preserve the agreed MVP and module boundaries. Do not rewrite the project from
scratch, add optional features, or implement application code.

Resolve these items consistently in design.md and affected steering documents:

1. Worker cancellation: choose bounded synchronous DSP steps/generators driven
   by an async worker scheduler that actually yields to the task queue between
   chunks. A local flag in an uninterrupted loop, or Promise.resolve() alone,
   cannot service cancel messages. Cover carrier generation, carrier search,
   symbol alignment, byte processing, and output conversion. Specify request IDs,
   a single-active-operation/busy policy, stale cancel handling, and exactly one
   terminal response per operation. Keep scheduling out of the pure DSP module.
   Measure acknowledgement from the caller's request; remove unmeasured timing
   guarantees. Add browser worker cancellation/race tests to the validation plan.

2. Decoder synchronization: keep coarse carrier scanning if useful, but recover
   symbol-boundary timing near the carrier-to-data transition. Specify a bounded
   sample-offset search and candidate validation using framing and known header
   bytes; never assume the file-origin grid is aligned. Distinguish tone zero,
   tone one, and insufficient/ambiguous signal rather than treating everything
   that is not one as zero. Add bounds before every correlation window/frame.
   Require all 160/147 sub-bit offsets in inexpensive header-level tests, plus
   representative complete fixtures at both rates, gain factors, and phases.
   Label thresholds as proposed until measured, not empirically established.

3. Correct 44.1 kHz carrier minimum to 900 bits = 132300 samples. Correct maximum
   output to 2183040 samples = 45.48 seconds = 4366124 bytes including WAV header.

4. Parsing: validate runtime encoder inputs before allocation; check minimum
   envelope and RIFF/header lengths before field reads; check RIFF extent and
   every chunk header/body/padding before access, including fmt and data chunks.
   Validate fmt minimum size, PCM blockAlign/byteRate, even data size, required
   chunk presence, and explicit duplicate/chunk-order policies. Define little-
   endian sample interpretation and bounded EOF behavior in every decoder stage.
   Preserve distinct truncation, framing, and CRC errors with no partial success.

5. Properties: arbitrary byte arrays use Kind=1. Kind=0 requires valid UTF-8 and
   empty filename bytes. Apply these domains consistently to every round-trip
   property; keep invalid-text rejection as a separate test.

6. Buffer lifetime: retain canonical WAV bytes or File/Blob for playback,
   visualization, downloads, and retry. Transfer disposable decode copies;
   pass a copy to decodeAudioData. Document ownership after each operation.
   Add play-then-download, imported-playback-after-decode, and repeat-play tests.

7. Consolidate all API signatures, error tags/tables, and pseudocode. Use a
   destination-buffer FSK writer or explicitly account for allocations; ensure
   public encode/decode orchestration contracts match the step-based worker.
   Keep filename sanitization outside fatal codec errors, and do not disguise
   unexpected internal exceptions as unsupported WAV input. Remove abandoned
   alternatives and contradictory prose from the final design.

8. CI must fail if its required ffprobe verification cannot run; local optional
   skips must be visible. Plan regression tests for every finding above.

Update the current progress snapshot in SKILL.md and append an honest entry to
docs/KIRO_USAGE.md, preserving prior entries as historical records. Credit the
review experiment to the assisting agent, and record your own verification
separately. Do not claim format validation proves algorithm correctness.

Present a concise Romanian change summary and stop at the revised design review
checkpoint. Do not create implementation tasks or start application code yet.
```

## Next gate

After this design revision is reviewed, generate native `tasks.md` with small
verifiable M1–M5 tasks. Start implementation with scaffold and the encoder's
independent tests; defer decorative UI until the M2 round-trip gate passes.
