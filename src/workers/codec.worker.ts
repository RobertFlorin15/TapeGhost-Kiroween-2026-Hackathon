/// <reference lib="webworker" />
import {
  runEncode,
  runDecode,
  type WorkerRequest,
  type WorkerResponse,
  type CancellationToken,
} from './protocol';

declare const self: DedicatedWorkerGlobalScope;

let activeRequestId: string | null = null;
let activeToken: CancellationToken | null = null;

function post(res: WorkerResponse, transfer?: Transferable[]): void {
  if (transfer && transfer.length > 0) {
    self.postMessage(res, transfer);
  } else {
    self.postMessage(res);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const req = event.data;

  if (req.type === 'cancel') {
    if (activeToken && activeRequestId === req.id) {
      activeToken.cancelled = true;
    }
    return; // stale cancels silently ignored
  }

  if (activeRequestId !== null) {
    post({ type: 'busy', id: req.id });
    return;
  }

  activeRequestId = req.id;
  const token: CancellationToken = { cancelled: false };
  activeToken = token;

  const run = async (): Promise<void> => {
    try {
      if (req.type === 'encode') {
        await runEncode(req, token, post);
      } else {
        await runDecode(req, token, post);
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      post({ type: 'error', id: req.id, error: { kind: 'internal-error', detail } });
    } finally {
      activeRequestId = null;
      activeToken = null;
    }
  };

  void run();
};
