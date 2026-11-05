import { describe, it, expect } from 'vitest';
import {
  runEncode,
  runDecode,
  type WorkerResponse,
  type CancellationToken,
  type WorkerEncodeRequest,
  type WorkerDecodeRequest,
} from '../../src/workers/protocol';
import { serializeEnvelope, encodeSamples, buildWav, TGHO_KIND_TEXT } from '../../src/dsp/index';

function collector(): { messages: WorkerResponse[]; post: (r: WorkerResponse) => void } {
  const messages: WorkerResponse[] = [];
  const post = (res: WorkerResponse): void => {
    messages.push(res);
  };
  return { messages, post };
}

const immediateYield = (): Promise<void> => Promise.resolve();

describe('runEncode', () => {
  it('posts exactly one terminal encode-result', async () => {
    const { messages, post } = collector();
    const token: CancellationToken = { cancelled: false };
    const req: WorkerEncodeRequest = {
      type: 'encode',
      id: 'e1',
      payload: {
        kind: TGHO_KIND_TEXT,
        payloadBytes: new TextEncoder().encode('hi'),
        filenameBytes: new Uint8Array(0),
      },
    };
    await runEncode(req, token, post, immediateYield);
    const terminal = messages.filter(
      (m) => m.type === 'encode-result' || m.type === 'error' || m.type === 'cancelled',
    );
    expect(terminal.length).toBe(1);
    expect(terminal[0].type).toBe('encode-result');
  });

  it('cancellation at first yield yields a single cancelled response, no result', async () => {
    const { messages, post } = collector();
    const token: CancellationToken = { cancelled: false };
    let first = true;
    const cancellingYield = (): Promise<void> => {
      if (first) {
        first = false;
        token.cancelled = true;
      }
      return Promise.resolve();
    };
    const req: WorkerEncodeRequest = {
      type: 'encode',
      id: 'e2',
      payload: {
        kind: TGHO_KIND_TEXT,
        payloadBytes: new TextEncoder().encode('hello'),
        filenameBytes: new Uint8Array(0),
      },
    };
    await runEncode(req, token, post, cancellingYield);
    const terminal = messages.filter(
      (m) => m.type === 'encode-result' || m.type === 'cancelled' || m.type === 'error',
    );
    expect(terminal.length).toBe(1);
    expect(terminal[0].type).toBe('cancelled');
    expect(messages.some((m) => m.type === 'encode-result')).toBe(false);
  });

  it('invalid encode input posts a single error response', async () => {
    const { messages, post } = collector();
    const token: CancellationToken = { cancelled: false };
    const req: WorkerEncodeRequest = {
      type: 'encode',
      id: 'e3',
      payload: {
        kind: TGHO_KIND_TEXT,
        payloadBytes: new Uint8Array(2000),
        filenameBytes: new Uint8Array(0),
      },
    };
    await runEncode(req, token, post, immediateYield);
    const errors = messages.filter((m) => m.type === 'error');
    expect(errors.length).toBe(1);
    if (errors[0].type === 'error') expect(errors[0].error.kind).toBe('payload-length-overflow');
  });
});

describe('runDecode', () => {
  it('round-trips: encode then decode via protocol recovers payload', async () => {
    const payload = new TextEncoder().encode('round trip');
    const env = serializeEnvelope({
      version: 1,
      kind: TGHO_KIND_TEXT,
      filenameBytes: new Uint8Array(0),
      payloadBytes: payload,
    });
    if (!(env instanceof Uint8Array)) throw new Error('serialize failed');
    const wavBuffer = buildWav(encodeSamples(env), 48000);

    const { messages, post } = collector();
    const token: CancellationToken = { cancelled: false };
    const req: WorkerDecodeRequest = { type: 'decode', id: 'd1', payload: { wavBuffer } };
    await runDecode(req, token, post, immediateYield);
    const results = messages.filter((m) => m.type === 'decode-result');
    expect(results.length).toBe(1);
    const r = results[0];
    if (r.type === 'decode-result') {
      expect(r.ok).toBe(true);
      expect(Array.from(r.payloadBytes ?? new Uint8Array())).toEqual(Array.from(payload));
    }
  });

  it('decode of silence posts a single decode-result with no-carrier error', async () => {
    const wavBuffer = buildWav(new Int16Array(300000), 48000);
    const { messages, post } = collector();
    const token: CancellationToken = { cancelled: false };
    const req: WorkerDecodeRequest = { type: 'decode', id: 'd2', payload: { wavBuffer } };
    await runDecode(req, token, post, immediateYield);
    const results = messages.filter((m) => m.type === 'decode-result');
    expect(results.length).toBe(1);
    if (results[0].type === 'decode-result') {
      expect(results[0].ok).toBe(false);
      expect(results[0].error?.kind).toBe('no-carrier');
    }
  });
});
