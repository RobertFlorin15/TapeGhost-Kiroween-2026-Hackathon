/**
 * E2E round-trip (Task 22, Req 1/2/6/10).
 *
 * Exercises the full user-facing pipeline across two independent browser
 * contexts: type text → Encode → download the WAV in context 1, then open a
 * FRESH context (no prior state), import that WAV, and assert the recovered
 * text is byte-identical to the original.
 *
 * The core assertion — recovered === original — is intentionally strict.
 * Selectors mirror the real DOM:
 *  - encode textarea:  #encode-text               (CassetteControls)
 *  - encode action:    button "Encode"            (CassetteControls)
 *  - download link:    <a download> "Download WAV" (CassetteControls)
 *  - decode input:     #decode-file (accept=".wav") (StatusPanel)
 *  - success region:   role="status" "✓ Decoded successfully — CRC verified"
 *  - recovered text:   <pre id="decoded-text">     (StatusPanel)
 */
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

const MESSAGE = 'Hello, TapeGhost! 123';

test.describe('round-trip encode → download → fresh session → import → recover', () => {
  test('recovers identical text in a fresh browser context', async ({ browser }) => {
    // --- Context 1: encode and download ------------------------------------
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto('/');

    await page1.locator('#encode-text').fill(MESSAGE);
    await page1.getByRole('button', { name: 'Encode' }).click();

    // Encoding runs in a Web Worker (<100 ms); the link appears when done.
    const downloadLink = page1.getByRole('link', { name: /download wav/i });
    await expect(downloadLink).toBeVisible({ timeout: 15000 });

    const downloadPromise = page1.waitForEvent('download');
    await downloadLink.click();
    const download = await downloadPromise;

    const tmp = mkdtempSync(join(tmpdir(), 'tg-e2e-'));
    const wavPath = join(tmp, 'roundtrip.wav');
    await download.saveAs(wavPath);
    await ctx1.close();

    // --- Context 2: FRESH session, import and recover ----------------------
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto('/');

    await page2.locator('#decode-file').setInputFiles(wavPath);

    // Several elements carry role="status" (the live <output> counters also map
    // to that implicit role), so scope to the decode success region by the
    // ".wav" outcome container that reports CRC verification.
    const status = page2.locator('.tg-outcome-success');
    await expect(status).toContainText('CRC verified', { timeout: 15000 });

    const decoded = page2.locator('#decoded-text');
    await expect(decoded).toHaveText(MESSAGE, { timeout: 15000 });

    await ctx2.close();
  });
});
