# Structure steering — TapeGhost

## Repository layout

```
SKILL.md                          # Project guide and progress (handoff document)
.kiro/
  steering/                       # product, tech, structure, dsp-correctness, testing, accessibility
  specs/tapeghost-mvp/            # requirements.md, design.md, tasks.md, .config.kiro
  hooks/                          # planned; not created until Kiro 1.4.62 schema verified
src/
  dsp/                            # Pure TypeScript codec — NO browser globals
    envelope.ts                   # TGHO envelope serialization and parsing
    crc32.ts                      # CRC-32/ISO-HDLC implementation
    framing.ts                    # 8N2 framing: bit-to-byte and byte-to-bit
    fsk.ts                        # FSK sine wave generation (encoder side)
    wav.ts                        # RIFF/WAVE builder (encoder) and parser (decoder)
    decoder.ts                    # Carrier acquisition, symbol timing, byte recovery
    errors.ts                     # Discriminated union error types
    index.ts                      # Re-exports for public DSP API
  workers/
    codec.worker.ts               # Web Worker: message protocol, cancellation, progress
  audio/
    playback.ts                   # Web Audio API: AudioContext lifecycle, play/stop
  components/                     # React components (UI only; no codec logic)
    CassetteControls.tsx
    WaveformDisplay.tsx
    BitInspector.tsx
    StatusPanel.tsx
  App.tsx
  main.tsx
tests/
  unit/
    envelope.test.ts              # Envelope serialization, CRC KAT, round-trip PBT
    fsk.test.ts                   # Signal independence: frequencies, cycle counts, phase
    wav.test.ts                   # WAV header parser, RIFF sizes
    decoder.test.ts               # Carrier acquisition, framing, error paths
    errors.test.ts                # Error category and detail string tests
  fixtures/
    independent/                  # Independently authored fixtures with provenance comments
    generated/                    # Encoder-generated fixtures (labeled as such)
  e2e/
    round-trip.spec.ts            # Playwright: encode → export → fresh session → import → recover
    error-paths.spec.ts           # Playwright: CRC mismatch, unsupported profile, silence
docs/
  PROJECT_PLAN.md
  KIRO_FIRST_PROMPT.md
  KIRO_REQUIREMENTS_REVIEW.md
  KIRO_USAGE.md                   # Honest log of Kiro actions only
  FORMAT.md                       # Frozen wire contract (after design approval)
  submission/                     # Pitch, demo script, checklist
README.md
LICENSE
package.json
package-lock.json
.gitignore
```

## Naming conventions

- DSP modules: kebab-case filenames, named exports only.
- React components: PascalCase filenames and component names.
- Test files: `<module>.test.ts` for unit, `<scenario>.spec.ts` for E2E.
- Fixture files: include provenance in a comment at the top of the file.

## .kiro tracking rule

`.kiro/` must remain tracked in Git. Do not add it to `.gitignore`. Steering, spec, and hook files are project artifacts.

## Sensitive files

Student enrollment evidence, credentials, private chat exports, and API keys must never be committed. The `.gitignore` covers common patterns; add explicitly if needed.
