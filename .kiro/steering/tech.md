# Tech steering — TapeGhost

## Stack

| Layer | Choice |
|-------|--------|
| UI framework | React (TypeScript strict mode) |
| Build | Vite |
| Styling | Tailwind CSS |
| Codec compute | Web Worker (`src/workers/codec.worker.ts`) |
| Audio playback | Web Audio API (AudioContext) |
| Visualization | Canvas API |
| Unit/property tests | Vitest + fast-check (fixed seeds) |
| E2E tests | Playwright (Chromium + Firefox) |
| Linting | ESLint + Prettier |
| Package manager | npm with committed lockfile |
| Deployment target | Cloudflare Pages (static; planned, unverified) |

No backend, no authentication, no database, no Rust, no WebAssembly, no paid API.

## Module independence rule

The DSP module (`src/dsp/`) must have zero imports from React, the DOM, `window`, `document`, `AudioContext`, or any browser-specific global. It must be importable and executable in a plain Node.js test process. This is a hard architectural invariant enforced by the test suite.

## Dependency policy

- Use exact or pinned versions in `package.json` when introducing dependencies.
- Prefer well-known, actively maintained packages.
- Flag any unusual package name before installing.
- Audit licenses before reusing assets or code from external repositories.

## TypeScript

Strict mode (`strict: true`) is required. No `any` without explicit justification in a comment. Discriminated unions for error types and codec results.

## Performance conventions

- All codec computation runs in a Web Worker, never on the main thread.
- Use typed arrays (`Int16Array`, `Float32Array`, `Uint8Array`) throughout the codec; avoid generic JavaScript arrays for sample data.
- The codec-owned working buffer budget is 64 MiB (typed-array and ArrayBuffer allocations, excluding input WAV and output audio samples).
- Cancellation uses a polling checkpoint inside the codec loop; do not rely on message-queue timing alone.

## Determinism

Given identical input and options, the encoder must produce bit-for-bit identical WAV output on the same tested runtime. No random dither, no timestamps, no entropy injection in the codec path.

## Reference device

Lenovo LOQ Essential 15IRX11 (model 83SC), Intel Core i5-13450HX, ~14.8 GiB RAM, Ubuntu 26.04 LTS x86_64, Google Chrome 155.0.8059.84. Record actual browser version and conditions when benchmarks run.
