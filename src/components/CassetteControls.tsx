/**
 * CassetteControls — the encoding panel (presentational).
 *
 * All state is owned by App; this component renders controlled inputs and
 * forwards user intent through callbacks. Structure and accessibility only —
 * decorative styling is deferred (Req 9, Req 12).
 */

export interface CassetteControlsProps {
  text: string;
  onTextChange: (t: string) => void;
  onFileChange: (file: File | null) => void;
  byteCount: number;
  durationSeconds: number;
  overLimit: boolean;
  canEncode: boolean;
  onEncode: () => void;
  downloadUrl: string | null;
  downloadName: string;
  canPlay: boolean;
  isPlaying: boolean;
  onPlayToggle: () => void;
  busy: boolean;
}

export default function CassetteControls({
  text,
  onTextChange,
  onFileChange,
  byteCount,
  durationSeconds,
  overLimit,
  canEncode,
  onEncode,
  downloadUrl,
  downloadName,
  canPlay,
  isPlaying,
  onPlayToggle,
  busy,
}: CassetteControlsProps) {
  return (
    <section aria-labelledby="encode-heading" className="tg-panel">
      <h2 id="encode-heading">Encode</h2>

      <div className="tg-field">
        <label htmlFor="encode-text">Text to encode (UTF-8)</label>
        <textarea
          id="encode-text"
          className="tg-focusable"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={4}
        />
      </div>

      <div className="tg-field">
        <label htmlFor="encode-file">Or choose a binary file (max 1024 bytes)</label>
        <input
          id="encode-file"
          className="tg-focusable"
          type="file"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="tg-field">
        <label htmlFor="byte-count">Payload size</label>
        <output id="byte-count" aria-live="polite">
          {byteCount.toLocaleString()} / 1024 bytes
        </output>
      </div>

      <div className="tg-field">
        <label htmlFor="duration-estimate">Estimated audio duration</label>
        <output id="duration-estimate" aria-live="polite">
          {durationSeconds.toFixed(1)} s
        </output>
      </div>

      {overLimit && (
        <p role="alert" className="tg-warning">
          Payload exceeds the 1024-byte limit. Remove {(byteCount - 1024).toLocaleString()} byte(s)
          to encode.
        </p>
      )}

      <div className="tg-actions">
        <button
          type="button"
          className="tg-focusable"
          onClick={onEncode}
          disabled={!canEncode || busy}
        >
          Encode
        </button>

        <button
          type="button"
          className="tg-focusable"
          onClick={onPlayToggle}
          disabled={!canPlay}
          aria-pressed={isPlaying}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        {downloadUrl !== null && (
          <a className="tg-focusable" href={downloadUrl} download={downloadName}>
            Download WAV
          </a>
        )}
      </div>
    </section>
  );
}
