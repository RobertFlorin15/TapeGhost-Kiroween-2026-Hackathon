/**
 * StatusPanel — the decoding panel (presentational).
 *
 * All state is owned by App; this component renders controlled inputs and
 * forwards user intent through callbacks. Structure and accessibility only —
 * decorative styling is deferred (Req 10, Req 8.6/8.7, Req 12).
 *
 * Accessibility notes:
 *  - Success region uses role="status" + aria-live="polite".
 *  - Error region uses role="alert" + aria-live="assertive".
 *  - Success and error each carry an explicit text label, so meaning never
 *    depends on color alone.
 *  - Recovered text is rendered as a plain text node (React escapes it); it is
 *    never injected via innerHTML / dangerouslySetInnerHTML.
 */

export interface StatusPanelProps {
  onImport: (file: File | null) => void;
  importError: string | null;
  decoding: boolean;
  progressPercent: number | null;
  outcome:
    | {
        kind: 'success';
        isText: boolean;
        text: string | null;
        downloadUrl: string | null;
        downloadName: string;
      }
    | { kind: 'error'; message: string }
    | null;
  canPlayImported: boolean;
  isPlayingImported: boolean;
  onPlayToggle: () => void;
  onClear: () => void;
}

export default function StatusPanel({
  onImport,
  importError,
  decoding,
  progressPercent,
  outcome,
  canPlayImported,
  isPlayingImported,
  onPlayToggle,
  onClear,
}: StatusPanelProps) {
  const success = outcome?.kind === 'success' ? outcome : null;
  const error = outcome?.kind === 'error' ? outcome : null;

  return (
    <section aria-labelledby="decode-heading" className="tg-panel">
      <h2 id="decode-heading">Decode</h2>

      <div className="tg-field">
        <label htmlFor="decode-file">Import a TapeGhost WAV file</label>
        <input
          id="decode-file"
          className="tg-focusable"
          type="file"
          accept=".wav"
          onChange={(e) => onImport(e.target.files?.[0] ?? null)}
        />
      </div>

      {importError !== null && (
        <p role="alert" className="tg-warning">
          {importError}
        </p>
      )}

      {decoding && (
        <div className="tg-field">
          <label htmlFor="decode-progress">Decoding…</label>
          <progress
            id="decode-progress"
            className="tg-progress"
            max={100}
            value={progressPercent ?? undefined}
          >
            {progressPercent !== null ? `${progressPercent}%` : 'Working…'}
          </progress>
        </div>
      )}

      <div className="tg-actions">
        <button
          type="button"
          className="tg-focusable"
          onClick={onPlayToggle}
          disabled={!canPlayImported}
          aria-pressed={isPlayingImported}
        >
          {isPlayingImported ? 'Stop imported WAV' : 'Play imported WAV'}
        </button>

        <button type="button" className="tg-focusable" onClick={onClear}>
          Clear
        </button>
      </div>

      {success !== null && (
        <div role="status" aria-live="polite" className="tg-outcome tg-outcome-success">
          <p className="tg-outcome-label">✓ Decoded successfully — CRC verified</p>
          {success.isText ? (
            <div className="tg-field">
              <label htmlFor="decoded-text">Recovered text</label>
              {/* Plain text node — React escapes content; never innerHTML. */}
              <pre id="decoded-text" className="tg-decoded-text">
                {success.text ?? ''}
              </pre>
            </div>
          ) : (
            <p>
              Recovered a binary file.{' '}
              {success.downloadUrl !== null && (
                <a
                  className="tg-focusable"
                  href={success.downloadUrl}
                  download={success.downloadName}
                >
                  Download {success.downloadName}
                </a>
              )}
            </p>
          )}
        </div>
      )}

      {error !== null && (
        <div role="alert" aria-live="assertive" className="tg-outcome tg-outcome-error">
          <p className="tg-outcome-label">✗ Decode failed</p>
          <p>{error.message}</p>
        </div>
      )}
    </section>
  );
}
