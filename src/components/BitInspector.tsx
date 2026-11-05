/**
 * BitInspector — keyboard-operable bit inspection table (presentational).
 *
 * All state is owned by App. This component renders the labeled numeric
 * Start/End controls (the accessibility-required keyboard equivalent to the
 * canvas drag) and a table of each bit's index, value, and tone frequency
 * (Req 11.2, 11.3, 11.6; Req 12.9).
 *
 * Bit value is conveyed as text (0 / 1) and the tone as a text frequency
 * label, never by color alone.
 *
 * Selection convention: when endBit < startBit, no region is selected and a
 * prompt is shown instead of the table.
 */

export interface BitInspectorProps {
  bits: ReadonlyArray<0 | 1> | null;
  startBit: number;
  endBit: number;
  onStartBitChange: (n: number) => void;
  onEndBitChange: (n: number) => void;
}

/** Tone label for a bit value (0 = 1200 Hz, 1 = 2400 Hz). */
function toneLabel(bit: 0 | 1): string {
  return bit === 0 ? '1200 Hz' : '2400 Hz';
}

export default function BitInspector({
  bits,
  startBit,
  endBit,
  onStartBitChange,
  onEndBitChange,
}: BitInspectorProps) {
  if (bits === null || bits.length === 0) {
    return (
      <section aria-labelledby="bits-heading" className="tg-panel">
        <h2 id="bits-heading">Bit inspector</h2>
        <p>Encode audio first to inspect bits.</p>
      </section>
    );
  }

  const maxBit = bits.length - 1;
  // A region is selected only when endBit is a valid index at/after startBit.
  const hasSelection = endBit >= startBit && startBit >= 0 && endBit <= maxBit;

  const clamp = (n: number): number => Math.min(maxBit, Math.max(0, n));

  const rows: Array<{ index: number; value: 0 | 1 }> = [];
  if (hasSelection) {
    for (let i = startBit; i <= endBit; i++) {
      rows.push({ index: i, value: bits[i] });
    }
  }

  return (
    <section aria-labelledby="bits-heading" className="tg-panel">
      <h2 id="bits-heading">Bit inspector</h2>

      <div className="tg-field">
        <label htmlFor="bit-start">Start bit</label>
        <input
          id="bit-start"
          className="tg-focusable"
          type="number"
          min={0}
          max={maxBit}
          value={startBit < 0 ? '' : startBit}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              onStartBitChange(0);
              return;
            }
            onStartBitChange(clamp(Number(v)));
          }}
        />
      </div>

      <div className="tg-field">
        <label htmlFor="bit-end">End bit</label>
        <input
          id="bit-end"
          className="tg-focusable"
          type="number"
          min={0}
          max={maxBit}
          value={endBit < 0 ? '' : endBit}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              onEndBitChange(-1);
              return;
            }
            onEndBitChange(clamp(Number(v)));
          }}
        />
      </div>

      {hasSelection ? (
        <>
          <p className="tg-bits-summary" aria-live="polite">
            Showing bits {startBit}–{endBit} of {bits.length}.
          </p>
          <table className="tg-bits-table">
            <thead>
              <tr>
                <th scope="col">Bit index</th>
                <th scope="col">Value</th>
                <th scope="col">Tone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index}>
                  <td>{r.index}</td>
                  <td>{r.value}</td>
                  <td>{toneLabel(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="tg-bits-prompt">
          Select a waveform region (drag on the waveform or set the start and
          end bits above) to inspect individual bits.
        </p>
      )}
    </section>
  );
}
