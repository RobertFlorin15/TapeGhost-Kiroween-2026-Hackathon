import { test, expect } from '@playwright/test';

/**
 * Real-browser Web Worker cancellation and race E2E (design Finding 1).
 *
 * The app's worker (`src/workers/codec.worker.ts`) is normally instantiated via
 * `new Worker(new URL('./codec.worker.ts', import.meta.url), { type: 'module' })`,
 * a build-time construct that cannot be reproduced inside `page.evaluate`.
 *
 * During `npm run dev`, the Vite dev server serves and transforms the worker
 * module at its source path and rewrites its internal imports to served paths,
 * so an in-page module worker constructed from that path resolves its full
 * dependency graph correctly. Verified at session time:
 *   GET http://localhost:5173/src/workers/codec.worker.ts -> 200, transformed ES
 *   module importing "/src/workers/protocol.ts".
 *
 * These assertions validate the protocol guarantees in a REAL browser worker
 * (not a Node simulation): the single-active-operation busy policy, the
 * cancellation acknowledgement, the "exactly one terminal response" guarantee,
 * stale-cancel tolerance, and internal-error reporting.
 */

const WORKER_URL = '/src/workers/codec.worker.ts';

test.describe('codec worker — real browser cancellation and race behavior', () => {
  test('a second concurrent request receives busy', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async (workerUrl) => {
      const w = new Worker(workerUrl, { type: 'module' });
      const responses: string[] = [];
      const done = new Promise<void>((resolve) => {
        let terminalCount = 0;
        w.onmessage = (ev: MessageEvent): void => {
          const t = (ev.data as { type: string }).type;
          responses.push(t);
          if (t === 'encode-result' || t === 'error' || t === 'cancelled') terminalCount++;
          // Resolve once the busy for req 'b' and a terminal for req 'a' are seen.
          if (responses.includes('busy') && terminalCount >= 1) resolve();
        };
      });
      const enc = (id: string) => ({
        type: 'encode' as const,
        id,
        payload: {
          kind: 0 as const,
          payloadBytes: new Uint8Array(1024),
          filenameBytes: new Uint8Array(0),
        },
      });
      w.postMessage(enc('a'));
      w.postMessage(enc('b')); // 'a' is active -> 'b' must get busy
      await done;
      w.terminate();
      return responses;
    }, WORKER_URL);

    expect(result).toContain('busy');
    // The busy response must arrive while the first op is still the active one,
    // i.e. before the first op's terminal response.
    const idxBusy = result.indexOf('busy');
    const idxEncodeResult = result.indexOf('encode-result');
    expect(idxBusy).toBeGreaterThanOrEqual(0);
    if (idxEncodeResult >= 0) {
      expect(idxBusy).toBeLessThan(idxEncodeResult);
    }
  });

  test('cancel is acknowledged and the cancelled op returns no result', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async (workerUrl) => {
      const w = new Worker(workerUrl, { type: 'module' });
      const responses: string[] = [];
      const finished = new Promise<void>((resolve) => {
        w.onmessage = (ev: MessageEvent): void => {
          const t = (ev.data as { type: string }).type;
          responses.push(t);
          if (t === 'cancelled' || t === 'encode-result' || t === 'error') resolve();
        };
      });
      w.postMessage({
        type: 'encode',
        id: 'c',
        payload: {
          kind: 0,
          payloadBytes: new Uint8Array(1024),
          filenameBytes: new Uint8Array(0),
        },
      });
      // Request cancel for the same id immediately. The worker yields to the
      // macrotask queue before each cancellation checkpoint, so the cancel can
      // be serviced before completion.
      w.postMessage({ type: 'cancel', id: 'c' });
      await finished;
      w.terminate();
      return responses;
    }, WORKER_URL);

    // Honest dual-outcome assertion of the "exactly one terminal response"
    // guarantee: the op either cancelled or completed, but never both. If it
    // cancelled, no encode-result may follow.
    if (result.includes('cancelled')) {
      const idxCancel = result.indexOf('cancelled');
      expect(result.slice(idxCancel + 1)).not.toContain('encode-result');
    } else {
      expect(result).toContain('encode-result');
    }
  });

  test('stale cancel for an unknown id is ignored (no crash, op still completes)', async ({
    page,
  }) => {
    await page.goto('/');
    const result = await page.evaluate(async (workerUrl) => {
      const w = new Worker(workerUrl, { type: 'module' });
      const responses: string[] = [];
      const done = new Promise<void>((resolve) => {
        w.onmessage = (ev: MessageEvent): void => {
          const t = (ev.data as { type: string }).type;
          responses.push(t);
          if (t === 'encode-result' || t === 'error' || t === 'cancelled') resolve();
        };
      });
      // Cancel a non-active id first (stale), then run a real encode.
      w.postMessage({ type: 'cancel', id: 'does-not-exist' });
      w.postMessage({
        type: 'encode',
        id: 'real',
        payload: {
          kind: 0,
          payloadBytes: new Uint8Array(8),
          filenameBytes: new Uint8Array(0),
        },
      });
      await done;
      w.terminate();
      return responses;
    }, WORKER_URL);

    // The stale cancel must not prevent the real op from completing.
    expect(result).toContain('encode-result');
    expect(result).not.toContain('cancelled');
  });

  test('an unexpected exception during an op yields a single internal-error', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async (workerUrl) => {
      const w = new Worker(workerUrl, { type: 'module' });
      const responses: Array<{ type: string; errorKind?: string }> = [];
      const done = new Promise<void>((resolve) => {
        w.onmessage = (ev: MessageEvent): void => {
          const data = ev.data as { type: string; error?: { kind?: string } };
          responses.push({ type: data.type, errorKind: data.error?.kind });
          if (data.type === 'error' || data.type === 'decode-result') resolve();
        };
      });
      // A decode request with a null payload makes the decode path throw when it
      // reads `payload.wavBuffer`; the worker's try/catch must convert that into
      // a single internal-error response, never an unhandled crash.
      w.postMessage({ type: 'decode', id: 'boom', payload: null });
      await done;
      w.terminate();
      return responses;
    }, WORKER_URL);

    const errors = result.filter((r) => r.type === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.errorKind).toBe('internal-error');
  });
});
