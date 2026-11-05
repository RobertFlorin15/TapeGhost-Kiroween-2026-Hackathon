/**
 * Accessibility E2E checks (Req 12.1–12.10).
 *
 * These are the AUTOMATED subset of the accessibility audit. They are real,
 * reproducible checks that run on both Chromium and Firefox:
 *   - keyboard reachability of every interactive control, in logical order;
 *   - a visible focus outline (>= 2 CSS px) on a focusable control;
 *   - no horizontal scroll at a 360 px viewport;
 *   - the app still renders with prefers-reduced-motion: reduce.
 *
 * They do NOT replace the manual screen-reader + keyboard-only walkthrough that
 * accessibility steering requires before release (see docs/KIRO_USAGE.md).
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Identify the focused element by a stable token: its id when present,
 * otherwise tag + type (e.g. "button", "a", "canvas").
 */
async function activeToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) return '';
    if (el.id) return el.id;
    const type = el.getAttribute('type');
    return el.tagName.toLowerCase() + (type ? `[${type}]` : '');
  });
}

/**
 * Encode a short text payload so the post-encode controls (waveform canvas,
 * bit-inspector Start/End inputs) exist in the DOM and can be tab-reached.
 */
async function encodeShortText(page: Page): Promise<void> {
  await page.locator('#encode-text').fill('hi');
  await page.getByRole('button', { name: 'Encode', exact: true }).click();
  // The bit-inspector numeric inputs appear only after a successful encode.
  await expect(page.locator('#bit-start')).toBeVisible({ timeout: 15_000 });
}

test.describe('accessibility', () => {
  test('all interactive controls are reachable by keyboard in logical order', async ({
    page,
  }) => {
    await page.goto('/');
    await encodeShortText(page);

    // Anchor on the first control (the encode textarea is first in reading
    // order) and walk one full Tab cycle from there. Stopping when focus
    // returns to the anchor yields a single, wrap-free pass of the tab order.
    await page.locator('#encode-text').focus();
    const order: string[] = ['encode-text'];
    // Generous upper bound; the real control count is well under this.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const token = await activeToken(page);
      if (!token) continue;
      if (token === 'encode-text') break; // wrapped back to the anchor
      if (order[order.length - 1] !== token) order.push(token);
    }

    // Every interactive control must be reachable by Tab alone.
    const required = [
      'encode-text', // encode textarea
      'encode-file', // encode file input
      'decode-file', // decode (import) file input
      'bit-start', // bit-inspector Start input (keyboard equiv. of drag)
      'bit-end', // bit-inspector End input
    ];
    for (const id of required) {
      expect(order, `"${id}" must be reachable by Tab`).toContain(id);
    }

    // The Encode and Clear buttons are reachable. They render with
    // type="button", so their token is "button[button]".
    const buttonStops = order.filter((t) => t.startsWith('button')).length;
    expect(buttonStops, 'Encode/Play/Clear buttons must be tab-reachable').toBeGreaterThanOrEqual(
      2,
    );

    // Logical order: encode controls precede decode controls precede the
    // bit-inspector inputs (top-to-bottom reading sequence, Req 12.3).
    const idx = (id: string): number => order.indexOf(id);
    expect(idx('encode-text')).toBeLessThan(idx('decode-file'));
    expect(idx('decode-file')).toBeLessThan(idx('bit-start'));
    expect(idx('bit-start')).toBeLessThan(idx('bit-end'));
  });

  test('focused control shows a visible focus outline (>=2px)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#encode-text').focus();

    const outline = await page.locator('#encode-text').evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth };
    });

    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test('no horizontal scroll at 360px width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    // Populate the heavier post-encode UI (waveform canvas, bit table) so the
    // 360 px check covers the widest content the page can show.
    await encodeShortText(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    // Allow 1 px for sub-pixel rounding.
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('renders with reduced motion enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // Smoke-level: the prefers-reduced-motion CSS media query is the real
    // mechanism; its effect is asserted here by the app rendering normally.
    await expect(page.getByRole('heading', { name: 'TapeGhost' })).toBeVisible();
  });
});
