import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WorkerRequest,
  WorkerResponse,
  EncodeRequestPayload,
  DecodeRequestPayload,
} from './protocol';

export interface CodecProgress {
  readonly percent: number;
  readonly stage: string;
}

export interface EncodeOutcome {
  readonly wavBuffer: ArrayBuffer;
  readonly durationSeconds: number;
  readonly envelopeByteCount: number;
  readonly wallClockMs: number;
}

export interface CodecWorkerApi {
  encode(payload: EncodeRequestPayload): void;
  decode(payload: DecodeRequestPayload, transfer: ArrayBuffer): void;
  cancel(): void;
  progress: CodecProgress | null;
  busy: boolean;
  onEncodeResult: (cb: (o: EncodeOutcome) => void) => void;
  onDecodeResult: (cb: (r: WorkerResponse) => void) => void;
}

export function useCodecWorker(): CodecWorkerApi {
  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const encodeCb = useRef<((o: EncodeOutcome) => void) | null>(null);
  const decodeCb = useRef<((r: WorkerResponse) => void) | null>(null);
  const [progress, setProgress] = useState<CodecProgress | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL('./codec.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent<WorkerResponse>): void => {
      const msg = ev.data;
      switch (msg.type) {
        case 'progress':
          setProgress({ percent: msg.percent, stage: msg.stage });
          break;
        case 'encode-result':
          setBusy(false);
          activeIdRef.current = null;
          setProgress(null);
          encodeCb.current?.({
            wavBuffer: msg.wavBuffer,
            durationSeconds: msg.durationSeconds,
            envelopeByteCount: msg.envelopeByteCount,
            wallClockMs: msg.wallClockMs,
          });
          break;
        case 'decode-result':
          setBusy(false);
          activeIdRef.current = null;
          setProgress(null);
          decodeCb.current?.(msg);
          break;
        case 'error':
          setBusy(false);
          activeIdRef.current = null;
          setProgress(null);
          decodeCb.current?.(msg);
          break;
        case 'cancelled':
          setBusy(false);
          activeIdRef.current = null;
          setProgress(null);
          break;
        case 'busy':
          // Another op in flight; ignored for the MVP single-active-op model.
          break;
      }
    };
    return (): void => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const send = useCallback((req: WorkerRequest, transfer?: ArrayBuffer): void => {
    const worker = workerRef.current;
    if (!worker) return;
    activeIdRef.current = req.id;
    setBusy(true);
    if (transfer) worker.postMessage(req, [transfer]);
    else worker.postMessage(req);
  }, []);

  const encode = useCallback(
    (payload: EncodeRequestPayload): void => {
      const id = `enc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      send({ type: 'encode', id, payload });
    },
    [send],
  );

  const decode = useCallback(
    (payload: DecodeRequestPayload, transfer: ArrayBuffer): void => {
      const id = `dec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      send({ type: 'decode', id, payload }, transfer);
    },
    [send],
  );

  const cancel = useCallback((): void => {
    const worker = workerRef.current;
    const id = activeIdRef.current;
    if (worker && id) worker.postMessage({ type: 'cancel', id } satisfies WorkerRequest);
  }, []);

  const onEncodeResult = useCallback((cb: (o: EncodeOutcome) => void): void => {
    encodeCb.current = cb;
  }, []);
  const onDecodeResult = useCallback((cb: (r: WorkerResponse) => void): void => {
    decodeCb.current = cb;
  }, []);

  return { encode, decode, cancel, progress, busy, onEncodeResult, onDecodeResult };
}
