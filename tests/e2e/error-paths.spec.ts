/**
 * E2E error paths (Task 23, Req 7/8/11).
 *
 * Exercises the user-facing decode error surfaces across the real browser UI:
 *  1. CRC mismatch — envelope-level mutation (NOT random WAV sample damage,
 *     per the testing steering CRC-mismatch procedure): serialize a valid
 *     envelope, flip one payload byte while leaving the CRC field intact,
 *     modulate through the standard encoder path, import, and assert the
 *     error region reports a CRC mismatch with no recovered payload.
 *  2. Unsupported WAV profile — a structurally valid RIFF/WAVE that is stereo
 *     (2 channels), which the parser rejects with a distinguishable detail.
 *  3. Non-.wav import — rejected at import time before the decode pipeline.
 *
 * Fixtures are built in the Node test process (Playwright specs run in Node);
 * the DSP is Node-safe by architectural invariant, so importing it here is fine.
 *
 * Selectors mirror the real DOM (StatusPanel.tsx):
 *  - decode input:   #decode-file (accept=".wav")
 *  - error region:   role="alert" ".tg-outcome-error" ("✗ Decode failed" + msg)
 *  - import warning: role="alert" ".tg-warning" (non-.wav rejection)
 *  - recovered text: <pre id="decoded-text">
 */
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync } from 'node:fs';
import {
  serializeEnvelope,
  encodeSamples,
  buildWav,
  TGHO_KIND_BINARY,
} from '../../src/dsp/index';

/**
 * Build a WAV whose envelope decodes structurally but fails the CRC check:
 * one payload byte is flipped while the original CRC field is left untouched.
 */
function makeCrcMismatchWav(): string {
  const env = serializeEnvelope({
    version: 1,
    kind: TGHO_KIND_BINARY,
    filenameBytes: new Uint8Array(0),
    payloadBytes: new Uint8Array([10, 20, 30, 40]),
  });
  if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
  const mutated = env.slice();
  mutated[12] ^= 0x01; // flip first payload byte; CRC field untouched
  const wav = buildWav(encodeSamples(mutated), 48000);
  const tmp = mkdtempSync(join(tmpdir(), 'tg-e2e-err-'));
  const p = join(tmp, 'crc-mismatch.wav');
  writeFileSync(p, new Uint8Array(wav));
  return p;
}

/**
 * Build a structurally valid RIFF/WAVE that is stereo (2 channels), which the
 * decoder rejects with an `unsupported-wav-profile` error.
 */
function makeUnsupportedProfileWav(): string {
  const dataBytes = 8;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const w = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // 2 channels (stereo) → unsupported
  view.setUint32(24, 48000, true);
  view.setUint32(28, 48000 * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, dataBytes, true);
  const tmp = mkdtempSync(join(tmpdir(), 'tg-e2e-err-'));
  const p = join(tmp, 'stereo.wav');
  writeFileSync(p, new Uint8Array(buffer));
  return p;
}

test.describe('decode error paths', () => {
  test('CRC mismatch shows a distinct error, no recovered text', async ({ page }) => {
    const wavPath = makeCrcMismatchWav();
    await page.goto('/');
    await page.locator('#decode-file').setInputFiles(wavPath);
    const err = page.locator('.tg-outcome-error');
    await expect(err).toBeVisible({ timeout: 15000 });
    await expect(err).toContainText(/CRC mismatch/i);
    // No recovered payload surfaced on error.
    await expect(page.locator('#decoded-text')).toHaveCount(0);
  });

  test('unsupported WAV profile (stereo) shows an unsupported-profile error', async ({ page }) => {
    const wavPath = makeUnsupportedProfileWav();
    await page.goto('/');
    await page.locator('#decode-file').setInputFiles(wavPath);
    const err = page.locator('.tg-outcome-error');
    await expect(err).toBeVisible({ timeout: 15000 });
    await expect(err).toContainText(/Unsupported WAV profile/i);
  });

  test('non-.wav file is rejected before decoding', async ({ page }) => {
    const tmp = mkdtempSync(join(tmpdir(), 'tg-e2e-err-'));
    const p = join(tmp, 'notes.txt');
    writeFileSync(p, 'this is not a wav');
    await page.goto('/');
    await page.locator('#decode-file').setInputFiles(p);
    // Import-time rejection uses the .tg-warning alert, not the decode pipeline.
    const warn = page.locator('.tg-warning');
    await expect(warn).toBeVisible({ timeout: 5000 });
    await expect(warn).toContainText(/\.wav/i);
  });
});
