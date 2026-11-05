import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CassetteControls from './components/CassetteControls';
import StatusPanel from './components/StatusPanel';
import WaveformDisplay from './components/WaveformDisplay';
import BitInspector from './components/BitInspector';
import { useCodecWorker, type EncodeOutcome } from './workers/useCodecWorker';
import { createPlaybackController, type PlaybackController } from './audio/playback';
import {
  TGHO_KIND_TEXT,
  TGHO_KIND_BINARY,
  formatError,
  sanitizeFilename,
  parseWav,
  serializeEnvelope,
  byteToFrameBits,
  type TghoKind,
} from './dsp/index';
import type { EncodeRequestPayload, WorkerResponse } from './workers/protocol';

type DecodeOutcome =
  | {
      kind: 'success';
      isText: boolean;
      text: string | null;
      downloadUrl: string | null;
      downloadName: string;
    }
  | { kind: 'error'; message: string }
  | null;

const MAX_PAYLOAD_BYTES = 1024;

/** Estimated audio duration for a given payload+filename size (design formula). */
function estimateDuration(filenameBytes: number, payloadBytes: number): number {
  return 5 + ((16 + filenameBytes + payloadBytes) * 11) / 300;
}

export default function App() {
  const worker = useCodecWorker();

  // Encoding input state.
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);

  // Encoded output state.
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(false);

  // Waveform + bit-inspection display state (Task 21).
  // Derived from the last successful encode; the DSP stays out of the
  // components by computing these here and passing them as props.
  const [displaySamples, setDisplaySamples] = useState<Int16Array | null>(null);
  const [displayBits, setDisplayBits] = useState<ReadonlyArray<0 | 1> | null>(null);
  // Selection convention: endBit < startBit means "no region selected" so the
  // bit inspector shows its prompt instead of a table.
  const [selStartBit, setSelStartBit] = useState(0);
  const [selEndBit, setSelEndBit] = useState(-1);

  // Canonical encoded WAV buffer (kept for download + repeat playback).
  const wavBufferRef = useRef<ArrayBuffer | null>(null);
  const playbackRef = useRef<PlaybackController | null>(null);

  // Snapshot of the exact payload sent to the worker for the current encode.
  // Re-serializing it on the main thread reproduces the same envelope bytes
  // the worker encoded, so the bit inspector shows the true framed sequence
  // without duplicating the decoder or reading them back off the worker.
  const encodeInputRef = useRef<{
    kind: TghoKind;
    payloadBytes: Uint8Array;
    filenameBytes: Uint8Array;
  } | null>(null);

  // Decoding input/output state.
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeOutcome, setDecodeOutcome] = useState<DecodeOutcome>(null);
  const [canPlayImported, setCanPlayImported] = useState(false);
  const [isPlayingImported, setIsPlayingImported] = useState(false);

  // Dedicated playback controller for the imported WAV (separate from encode).
  const importPlaybackRef = useRef<PlaybackController | null>(null);
  // Blob URL of a recovered binary file, tracked so it can be revoked on clear.
  const decodeDownloadUrlRef = useRef<string | null>(null);

  // Lazily create the playback controllers; dispose on unmount.
  useEffect(() => {
    playbackRef.current = createPlaybackController();
    importPlaybackRef.current = createPlaybackController();
    return () => {
      void playbackRef.current?.dispose();
      playbackRef.current = null;
      void importPlaybackRef.current?.dispose();
      importPlaybackRef.current = null;
    };
  }, []);

  // Revoke the recovered-binary blob URL on unmount (no leaks).
  useEffect(() => {
    return () => {
      if (decodeDownloadUrlRef.current !== null) {
        URL.revokeObjectURL(decodeDownloadUrlRef.current);
      }
    };
  }, []);

  // Revoke any previous blob URL when it changes or on unmount (no leaks).
  useEffect(() => {
    return () => {
      if (downloadUrl !== null) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  // Read the selected file's bytes once, asynchronously.
  useEffect(() => {
    let cancelled = false;
    if (file === null) {
      setFileBytes(null);
      return;
    }
    void file.arrayBuffer().then((buf) => {
      if (!cancelled) setFileBytes(new Uint8Array(buf));
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // A file selection takes precedence over text (Kind=1 binary flow).
  const usingFile = file !== null;

  const textBytes = useMemo(() => new TextEncoder().encode(text), [text]);
  const filenameBytes = useMemo(
    () => (usingFile && file ? new TextEncoder().encode(file.name) : new Uint8Array(0)),
    [usingFile, file],
  );

  const payloadByteCount = usingFile ? (fileBytes?.length ?? 0) : textBytes.length;
  const filenameByteCount = filenameBytes.length;
  const byteCount = payloadByteCount;
  const overLimit = byteCount > MAX_PAYLOAD_BYTES;
  const durationSeconds = estimateDuration(filenameByteCount, payloadByteCount);

  const hasContent = usingFile ? payloadByteCount > 0 : text.length > 0;
  const canEncode = hasContent && !overLimit && filenameByteCount <= 64;

  // Receive encode results: store canonical buffer, create download URL, load playback.
  const handleEncodeResult = useCallback((o: EncodeOutcome): void => {
    const buffer = o.wavBuffer;
    wavBufferRef.current = buffer;

    // Blob copies the bytes, so the ArrayBuffer stays usable for playback.
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    setDownloadUrl((prev) => {
      if (prev !== null) URL.revokeObjectURL(prev);
      return url;
    });

    // playback.load() copies internally (decodeAudioData detaches its copy),
    // so the canonical buffer remains intact for future downloads/plays.
    setCanPlay(false);
    setIsPlaying(false);
    void playbackRef.current?.load(buffer).then(() => setCanPlay(true));

    // Derive the waveform samples for display. parseWav returns a standalone
    // Int16Array copy and does not detach the buffer, so the canonical buffer
    // stays usable for download and playback.
    const parsed = parseWav(buffer);
    setDisplaySamples('samples' in parsed ? parsed.samples : null);

    // Rebuild the exact framed bit sequence by re-serializing the same payload
    // the worker encoded, then expanding each envelope byte into its 11 8N2
    // bit-periods (start + 8 data LSB-first + 2 stop). Deterministic: matches
    // the encoded audio bit-for-bit.
    const input = encodeInputRef.current;
    if (input !== null) {
      const env = serializeEnvelope({
        version: 1,
        kind: input.kind,
        filenameBytes: input.filenameBytes,
        payloadBytes: input.payloadBytes,
      });
      if (env instanceof Uint8Array) {
        const bits: Array<0 | 1> = [];
        for (let b = 0; b < env.length; b++) {
          const frame = byteToFrameBits(env[b]);
          for (const bit of frame) bits.push(bit);
        }
        setDisplayBits(bits);
      } else {
        setDisplayBits(null);
      }
    } else {
      setDisplayBits(null);
    }

    // Reset the selection to the "no region selected" state for the new signal.
    setSelStartBit(0);
    setSelEndBit(-1);
  }, []);

  useEffect(() => {
    worker.onEncodeResult(handleEncodeResult);
  }, [worker, handleEncodeResult]);

  // Receive decode results (decode-result or error) and map to the outcome prop.
  const handleDecodeResult = useCallback((msg: WorkerResponse): void => {
    setDecoding(false);

    // Revoke any previous recovered-binary URL before producing a new outcome.
    if (decodeDownloadUrlRef.current !== null) {
      URL.revokeObjectURL(decodeDownloadUrlRef.current);
      decodeDownloadUrlRef.current = null;
    }

    if (msg.type === 'error') {
      setDecodeOutcome({ kind: 'error', message: formatError(msg.error) });
      return;
    }
    if (msg.type !== 'decode-result') return;

    if (!msg.ok) {
      // On failure never surface any partial payload.
      const message =
        msg.error !== undefined
          ? formatError(msg.error)
          : 'Decode failed: unknown error';
      setDecodeOutcome({ kind: 'error', message });
      return;
    }

    if (msg.kind === TGHO_KIND_TEXT) {
      const text = new TextDecoder().decode(msg.payloadBytes ?? new Uint8Array(0));
      setDecodeOutcome({
        kind: 'success',
        isText: true,
        text,
        downloadUrl: null,
        downloadName: '',
      });
    } else {
      const bytes = msg.payloadBytes ?? new Uint8Array(0);
      const name = sanitizeFilename(msg.filenameBytes ?? new Uint8Array(0));
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      decodeDownloadUrlRef.current = url;
      setDecodeOutcome({
        kind: 'success',
        isText: false,
        text: null,
        downloadUrl: url,
        downloadName: name,
      });
    }
  }, []);

  useEffect(() => {
    worker.onDecodeResult(handleDecodeResult);
  }, [worker, handleDecodeResult]);

  const onImport = useCallback(
    (f: File | null): void => {
      // Reset the imported-playback state for any new selection.
      importPlaybackRef.current?.stop();
      setIsPlayingImported(false);
      setCanPlayImported(false);

      if (f === null) {
        setImportedFile(null);
        setImportError(null);
        return;
      }

      // Reject non-.wav before decoding (case-insensitive extension check).
      if (!f.name.toLowerCase().endsWith('.wav')) {
        setImportedFile(null);
        setImportError(`Unsupported file type: "${f.name}". Please choose a .wav file.`);
        setDecodeOutcome(null);
        return;
      }

      setImportError(null);
      setDecodeOutcome(null);
      setImportedFile(f);

      // Read the file's bytes once; transfer that buffer to the worker, and
      // separately load a copy into the imported-playback controller.
      void f.arrayBuffer().then((buf) => {
        // Load imported WAV for playback (load() slices internally).
        void importPlaybackRef.current?.load(buf).then(() => setCanPlayImported(true));
        // Transfer a fresh copy to the worker so the playback copy is unaffected.
        const forWorker = buf.slice(0);
        setDecoding(true);
        worker.decode({ wavBuffer: forWorker }, forWorker);
      });
    },
    [worker],
  );

  const onImportPlayToggle = useCallback((): void => {
    const controller = importPlaybackRef.current;
    if (!controller) return;
    if (isPlayingImported) {
      controller.stop();
      setIsPlayingImported(false);
    } else {
      controller.play();
      setIsPlayingImported(true);
    }
  }, [isPlayingImported]);

  const onClearDecode = useCallback((): void => {
    importPlaybackRef.current?.stop();
    setIsPlayingImported(false);
    setCanPlayImported(false);
    setImportedFile(null);
    setImportError(null);
    setDecodeOutcome(null);
    setDecoding(false);
    if (decodeDownloadUrlRef.current !== null) {
      URL.revokeObjectURL(decodeDownloadUrlRef.current);
      decodeDownloadUrlRef.current = null;
    }
  }, []);

  const downloadName = usingFile && file ? `${file.name}.wav` : 'tapeghost.wav';

  const onEncode = useCallback((): void => {
    let payload: EncodeRequestPayload;
    if (usingFile) {
      if (fileBytes === null) return;
      payload = {
        kind: TGHO_KIND_BINARY,
        payloadBytes: fileBytes,
        filenameBytes,
      };
    } else {
      payload = {
        kind: TGHO_KIND_TEXT,
        payloadBytes: textBytes,
        filenameBytes: new Uint8Array(0),
      };
    }
    // Snapshot the exact bytes sent so the bit inspector can reproduce the
    // framed sequence once the encode result arrives.
    encodeInputRef.current = {
      kind: payload.kind,
      payloadBytes: payload.payloadBytes,
      filenameBytes: payload.filenameBytes,
    };
    worker.encode(payload);
  }, [usingFile, fileBytes, filenameBytes, textBytes, worker]);

  const onPlayToggle = useCallback((): void => {
    const controller = playbackRef.current;
    if (!controller) return;
    if (isPlaying) {
      controller.stop();
      setIsPlaying(false);
    } else {
      controller.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Canvas drag → bit region. Produces the identical output path as the
  // numeric Start/End inputs in the bit inspector (Req 11.6).
  const onWaveformRegionChange = useCallback(
    (startBit: number, endBit: number): void => {
      setSelStartBit(startBit);
      setSelEndBit(endBit);
    },
    [],
  );

  const totalBits = displayBits?.length ?? 0;

  return (
    <main className="tg-app">
      <header>
        <h1>TapeGhost</h1>
        <p>Bring forgotten data back to life.</p>
      </header>

      <CassetteControls
        text={text}
        onTextChange={setText}
        onFileChange={setFile}
        byteCount={byteCount}
        durationSeconds={durationSeconds}
        overLimit={overLimit}
        canEncode={canEncode}
        onEncode={onEncode}
        downloadUrl={downloadUrl}
        downloadName={downloadName}
        canPlay={canPlay}
        isPlaying={isPlaying}
        onPlayToggle={onPlayToggle}
        busy={worker.busy}
      />

      <StatusPanel
        onImport={onImport}
        importError={importError}
        decoding={decoding}
        progressPercent={decoding ? (worker.progress?.percent ?? null) : null}
        outcome={decodeOutcome}
        canPlayImported={canPlayImported && importedFile !== null}
        isPlayingImported={isPlayingImported}
        onPlayToggle={onImportPlayToggle}
        onClear={onClearDecode}
      />

      {/* Waveform — Task 21.
          Static canvas render (no animation) honors prefers-reduced-motion by
          construction; the numeric Start/End inputs in BitInspector are the
          keyboard-operable equivalent to the canvas drag selection. */}
      <section aria-labelledby="waveform-heading" className="tg-panel">
        <h2 id="waveform-heading">Waveform</h2>
        <WaveformDisplay
          samples={displaySamples}
          totalBits={totalBits}
          onRegionChange={onWaveformRegionChange}
        />
      </section>

      <BitInspector
        bits={displayBits}
        startBit={selStartBit}
        endBit={selEndBit}
        onStartBitChange={setSelStartBit}
        onEndBitChange={setSelEndBit}
      />
    </main>
  );
}
