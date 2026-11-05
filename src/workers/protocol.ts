import {
  serializeEnvelope,
  encodeSamples,
  buildWav,
  parseWav,
  decodeWav,
  type TghoKind,
  type TghoError,
} from '../dsp/index';

export interface EncodeRequestPayload {
  readonly kind: TghoKind;
  readonly payloadBytes: Uint8Array;
  readonly filenameBytes: Uint8Array;
}
export interface DecodeRequestPayload {
  readonly wavBuffer: ArrayBuffer;
}

export interface WorkerEncodeRequest {
  readonly type: 'encode';
  readonly id: string;
  readonly payload: EncodeRequestPayload;
}
export interface WorkerDecodeRequest {
  readonly type: 'decode';
  readonly id: string;
  readonly payload: DecodeRequestPayload;
}
export interface WorkerCancelRequest {
  readonly type: 'cancel';
  readonly id: string;
}
export type WorkerRequest = WorkerEncodeRequest | WorkerDecodeRequest | WorkerCancelRequest;

export interface WorkerProgressResponse {
  readonly type: 'progress';
  readonly id: string;
  readonly percent: number;
  readonly stage: string;
}
export interface WorkerEncodeResultResponse {
  readonly type: 'encode-result';
  readonly id: string;
  readonly wavBuffer: ArrayBuffer;
  readonly durationSeconds: number;
  readonly envelopeByteCount: number;
  readonly wallClockMs: number;
}
export interface WorkerDecodeResultResponse {
  readonly type: 'decode-result';
  readonly id: string;
  readonly ok: boolean;
  readonly kind?: TghoKind;
  readonly payloadBytes?: Uint8Array;
  readonly filenameBytes?: Uint8Array;
  readonly error?: TghoError;
  readonly wallClockMs: number;
}
export interface WorkerErrorResponse {
  readonly type: 'error';
  readonly id: string;
  readonly error: TghoError;
}
export interface WorkerCancelledResponse {
  readonly type: 'cancelled';
  readonly id: string;
}
export interface WorkerBusyResponse {
  readonly type: 'busy';
  readonly id: string;
}
export type WorkerResponse =
  | WorkerProgressResponse
  | WorkerEncodeResultResponse
  | WorkerDecodeResultResponse
  | WorkerErrorResponse
  | WorkerCancelledResponse
  | WorkerBusyResponse;

export interface CancellationToken {
  cancelled: boolean;
}

export type PostResponse = (res: WorkerResponse, transfer?: Transferable[]) => void;
export type YieldFn = () => Promise<void>;

/** Default yield: defers to the macrotask queue so queued messages are serviced. */
export const defaultYield: YieldFn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export async function runEncode(
  req: WorkerEncodeRequest,
  token: CancellationToken,
  post: PostResponse,
  yieldToQueue: YieldFn = defaultYield,
): Promise<void> {
  const t0 = nowMs();
  const env = serializeEnvelope({
    version: 1,
    kind: req.payload.kind,
    filenameBytes: req.payload.filenameBytes,
    payloadBytes: req.payload.payloadBytes,
  });
  if (!(env instanceof Uint8Array)) {
    post({ type: 'error', id: req.id, error: env });
    return;
  }

  post({ type: 'progress', id: req.id, percent: 0, stage: 'Serializing envelope' });
  await yieldToQueue();
  if (token.cancelled) {
    post({ type: 'cancelled', id: req.id });
    return;
  }

  post({ type: 'progress', id: req.id, percent: 25, stage: 'Generating carrier and data' });
  await yieldToQueue();
  if (token.cancelled) {
    post({ type: 'cancelled', id: req.id });
    return;
  }

  const samples = encodeSamples(env);

  post({ type: 'progress', id: req.id, percent: 85, stage: 'Assembling WAV' });
  await yieldToQueue();
  if (token.cancelled) {
    post({ type: 'cancelled', id: req.id });
    return;
  }

  const wavBuffer = buildWav(samples, 48000);
  const durationSeconds = samples.length / 48000;
  const wallClockMs = nowMs() - t0;
  post(
    {
      type: 'encode-result',
      id: req.id,
      wavBuffer,
      durationSeconds,
      envelopeByteCount: env.length,
      wallClockMs,
    },
    [wavBuffer],
  );
}

export async function runDecode(
  req: WorkerDecodeRequest,
  token: CancellationToken,
  post: PostResponse,
  yieldToQueue: YieldFn = defaultYield,
): Promise<void> {
  const t0 = nowMs();
  post({ type: 'progress', id: req.id, percent: 10, stage: 'Parsing WAV' });
  await yieldToQueue();
  if (token.cancelled) {
    post({ type: 'cancelled', id: req.id });
    return;
  }

  const wav = parseWav(req.payload.wavBuffer);
  if (!('samples' in wav)) {
    post({ type: 'decode-result', id: req.id, ok: false, error: wav, wallClockMs: nowMs() - t0 });
    return;
  }

  post({ type: 'progress', id: req.id, percent: 40, stage: 'Decoding signal' });
  await yieldToQueue();
  if (token.cancelled) {
    post({ type: 'cancelled', id: req.id });
    return;
  }

  const result = decodeWav(wav);
  const wallClockMs = nowMs() - t0;
  if (result.ok) {
    post({
      type: 'decode-result',
      id: req.id,
      ok: true,
      kind: result.kind,
      payloadBytes: result.payloadBytes,
      filenameBytes: result.filenameBytes,
      wallClockMs,
    });
  } else {
    post({ type: 'decode-result', id: req.id, ok: false, error: result.error, wallClockMs });
  }
}
