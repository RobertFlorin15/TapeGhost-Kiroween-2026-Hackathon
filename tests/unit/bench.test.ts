/**
 * Codec performance measurement and buffer-budget instrumentation (Task 25 / 25.1).
 *
 * These tests MEASURE and LOG codec wall-clock and codec-owned allocation for the
 * maximum 1024-byte payload. They are NOT a hard performance gate: the production
 * 2-second target (Req 13.1 / 13.2) is defined for the browser codec worker, and
 * these numbers are produced by a plain Node process on the reference device. The
 * loose 30 s guard only prevents the suite from hanging; the real target is read
 * from the logged `[bench]` numbers and recorded in docs/KIRO_USAGE.md.
 *
 * The buffer-budget assertion (Req 13.3) is a real gate: codec-owned typed-array
 * allocation for the maximum envelope must stay under 64 MiB.
 *
 * Runs in a plain Node process (no browser globals), consistent with the DSP
 * Node-safety invariant.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeEnvelope,
  TGHO_KIND_BINARY,
  encodeSamples,
  buildWav,
  parseWav,
  CARRIER_SAMPLES,
  SAMPLES_PER_BIT,
} from '../../src/dsp/index';
import { decodeWav } from '../../src/dsp/decoder';

const MiB = 1024 * 1024;
const BUDGET_BYTES = 64 * MiB; // 67,108,864

/** Maximum TGHO envelope: 64-byte filename + 1024-byte payload (Kind=1). */
function maxEnvelopeBytes(): Uint8Array {
  const filename = new Uint8Array(64);
  for (let i = 0; i < 64; i++) filename[i] = 0x41 + (i % 26); // printable ASCII
  const payload = new Uint8Array(1024);
  for (let i = 0; i < 1024; i++) payload[i] = (i * 31) & 0xff;
  const env = serializeEnvelope({
    version: 1,
    kind: TGHO_KIND_BINARY,
    filenameBytes: filename,
    payloadBytes: payload,
  });
  if (!(env instanceof Uint8Array)) {
    throw new Error('serializeEnvelope failed: ' + JSON.stringify(env));
  }
  return env;
}

function stats(xs: number[]): string {
  const s = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const median = s[Math.floor(s.length / 2)];
  return `min=${s[0].toFixed(1)} median=${median.toFixed(1)} mean=${mean.toFixed(1)} max=${s[s.length - 1].toFixed(1)} ms`;
}

describe('codec buffer budget (Req 13.3)', () => {
  it('encoder output for the maximum payload stays well under 64 MiB', () => {
    const env = maxEnvelopeBytes();
    // Maximum envelope = 12 header + 64 filename + 1024 payload + 4 CRC = 1104 bytes.
    expect(env.length).toBe(1104);

    const samples = encodeSamples(env);
    const codecOwnedBytes = samples.length * 2; // Int16Array → 2 bytes/sample

    console.log(
      `[budget] max-envelope ${env.length} B → ${samples.length} samples → ` +
        `${(codecOwnedBytes / MiB).toFixed(2)} MiB codec-owned (limit ${BUDGET_BYTES / MiB} MiB)`,
    );

    // Dominant codec-owned allocation (the output sample buffer) must fit the budget.
    expect(codecOwnedBytes).toBeLessThan(BUDGET_BYTES);

    // Sanity: sample count matches the design arithmetic exactly.
    // carrier (240,000) + 1104 bytes × 11 bit-periods/byte × 160 samples/bit
    //   = 240,000 + 1,943,040 = 2,183,040 samples.
    expect(samples.length).toBe(CARRIER_SAMPLES + 1104 * 11 * SAMPLES_PER_BIT);
    expect(samples.length).toBe(2_183_040);
  });

  it('WAV container for the maximum payload stays well under 64 MiB', () => {
    const env = maxEnvelopeBytes();
    const samples = encodeSamples(env);
    const wav = buildWav(samples, 48000);
    // 44-byte header + sample bytes.
    expect(wav.byteLength).toBe(44 + samples.length * 2);
    console.log(`[budget] WAV container ${(wav.byteLength / MiB).toFixed(2)} MiB`);
    expect(wav.byteLength).toBeLessThan(BUDGET_BYTES);
  });
});

describe('codec performance (Req 13.1 / 13.2) — measurement, not a hard gate', () => {
  const RUNS = 20;

  it(`reports encode wall-clock for the max payload over ${RUNS} runs`, () => {
    const env = maxEnvelopeBytes();
    const encTimes: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      const samples = encodeSamples(env);
      const wav = buildWav(samples, 48000);
      encTimes.push(performance.now() - t0);
      // Touch the result so the work is not optimized away.
      if (wav.byteLength === 0) throw new Error('empty WAV');
    }
    console.log(`[bench] encode (1024B payload, ${RUNS} runs): ${stats(encTimes)}`);
    expect(Math.max(...encTimes)).toBeLessThan(30000);
  });

  it(`reports decode wall-clock for the max payload over ${RUNS} runs`, () => {
    const env = maxEnvelopeBytes();
    const wav = buildWav(encodeSamples(env), 48000);

    const decTimes: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const copy = wav.slice(0);
      const t0 = performance.now();
      const parsed = parseWav(copy);
      if (!('samples' in parsed)) throw new Error('parseWav failed: ' + JSON.stringify(parsed));
      const result = decodeWav(parsed);
      decTimes.push(performance.now() - t0);
      if (!result.ok) throw new Error('decode failed: ' + JSON.stringify(result.error));
    }
    console.log(`[bench] decode (1024B payload, ${RUNS} runs): ${stats(decTimes)}`);
    expect(Math.max(...decTimes)).toBeLessThan(30000);
  });
});
