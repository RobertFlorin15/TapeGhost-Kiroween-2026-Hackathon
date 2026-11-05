/**
 * Web Audio API playback for TapeGhost.
 *
 * Browser-only (main thread). Not part of the DSP layer; never imported by it.
 *
 * Buffer-lifetime rule (design Finding 6): decodeAudioData DETACHES its input
 * ArrayBuffer, so load() always decodes a COPY. The caller's canonical WAV
 * buffer (used for download and repeat play) is never passed directly.
 */

export type PlaybackState = 'idle' | 'loaded' | 'playing';

export interface PlaybackController {
  load(wavBuffer: ArrayBuffer): Promise<void>;
  play(): void;
  stop(): void;
  readonly state: PlaybackState;
  dispose(): Promise<void>;
}

class WebAudioPlayback implements PlaybackController {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private _state: PlaybackState = 'idle';

  get state(): PlaybackState {
    return this._state;
  }

  private ensureContext(): AudioContext {
    if (this.ctx === null) {
      // Lazy init: only on first user-gesture-driven call.
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  async load(wavBuffer: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    // Copy: decodeAudioData detaches its argument. Keep the caller's buffer intact.
    const copy = wavBuffer.slice(0);
    this.buffer = await ctx.decodeAudioData(copy);
    this._state = 'loaded';
  }

  play(): void {
    if (this.buffer === null) return;
    const ctx = this.ensureContext();
    // Resume if the context was suspended by autoplay policy.
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    // Stop any current source first (single-use nodes).
    this.stopSource();
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(ctx.destination);
    source.onended = (): void => {
      if (this.source === source) {
        this.source = null;
        if (this._state === 'playing') this._state = 'loaded';
      }
    };
    source.start();
    this.source = source;
    this._state = 'playing';
  }

  stop(): void {
    this.stopSource();
    if (this._state === 'playing') this._state = 'loaded';
  }

  private stopSource(): void {
    if (this.source !== null) {
      try {
        this.source.onended = null;
        this.source.stop();
        this.source.disconnect();
      } catch {
        // already stopped; ignore
      }
      this.source = null;
    }
  }

  async dispose(): Promise<void> {
    this.stopSource();
    this.buffer = null;
    this._state = 'idle';
    if (this.ctx !== null) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}

/** Create a new playback controller. */
export function createPlaybackController(): PlaybackController {
  return new WebAudioPlayback();
}
