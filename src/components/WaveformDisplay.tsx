/**
 * WaveformDisplay — static canvas render of the encoded audio (presentational).
 *
 * The DSP stays out of this component: App parses the encoded WAV buffer into
 * an Int16 sample array and passes it in. This component only draws and maps
 * pixel selections to bit indices (Req 11.1, 11.2, 11.4, 11.5; Req 12.9).
 *
 * Accessibility:
 *  - The canvas carries role="img" and a descriptive aria-label stating the
 *    encoding scheme, total bit count, and tone-to-bit mapping, so the
 *    educational content is available without the visual rendering.
 *  - Rendering is a single static draw; no CSS/JS animation is introduced, so
 *    `prefers-reduced-motion` is honored by construction.
 *
 * The carrier prefix (CARRIER_SAMPLES) carries no framed bits, so only the
 * data region [CARRIER_SAMPLES, end) maps onto bit indices [0, totalBits).
 */

import { useCallback, useEffect, useRef } from 'react';
import { CARRIER_SAMPLES } from '../dsp/index';

export interface WaveformDisplayProps {
  samples: Int16Array | null;
  totalBits: number;
  /** Called with a clamped, ordered [startBit, endBit] from canvas drag. */
  onRegionChange: (startBit: number, endBit: number) => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 160;
const INT16_MAX = 32768;

/** Map an x pixel (0..width) to a bit index, accounting for the carrier prefix. */
function pixelToBit(
  x: number,
  width: number,
  sampleCount: number,
  totalBits: number,
): number {
  if (totalBits <= 0 || sampleCount <= CARRIER_SAMPLES) return 0;
  const frac = Math.min(1, Math.max(0, x / width));
  const sample = frac * sampleCount;
  const dataSamples = sampleCount - CARRIER_SAMPLES;
  const bit = Math.floor(((sample - CARRIER_SAMPLES) / dataSamples) * totalBits);
  return Math.min(totalBits - 1, Math.max(0, bit));
}

export default function WaveformDisplay({
  samples,
  totalBits,
  onRegionChange,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartX = useRef<number | null>(null);

  // Static render: downsample to one min/max column per canvas pixel.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);
    // Background.
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    // Zero-amplitude baseline.
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    if (samples === null || samples.length === 0) return;

    const n = samples.length;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const start = Math.floor((x / w) * n);
      const end = Math.max(start + 1, Math.floor(((x + 1) / w) * n));
      let min = INT16_MAX;
      let max = -INT16_MAX;
      for (let i = start; i < end && i < n; i++) {
        const s = samples[i];
        if (s < min) min = s;
        if (s > max) max = s;
      }
      const yMax = mid - (max / INT16_MAX) * mid;
      const yMin = mid - (min / INT16_MAX) * mid;
      ctx.moveTo(x + 0.5, yMax);
      ctx.lineTo(x + 0.5, yMin);
    }
    ctx.stroke();
  }, [samples]);

  const localX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (canvas === null) return 0;
    const rect = canvas.getBoundingClientRect();
    // Scale from CSS pixels back to the canvas backing-store coordinate space.
    const scale = canvas.width / rect.width;
    return (clientX - rect.left) * scale;
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (samples === null) return;
      dragStartX.current = localX(e.clientX);
    },
    [samples, localX],
  );

  const commitSelection = useCallback(
    (clientX: number): void => {
      if (samples === null || dragStartX.current === null) return;
      const canvas = canvasRef.current;
      if (canvas === null) return;
      const x0 = dragStartX.current;
      const x1 = localX(clientX);
      const bitA = pixelToBit(x0, canvas.width, samples.length, totalBits);
      const bitB = pixelToBit(x1, canvas.width, samples.length, totalBits);
      const startBit = Math.min(bitA, bitB);
      const endBit = Math.max(bitA, bitB);
      onRegionChange(startBit, endBit);
    },
    [samples, totalBits, onRegionChange, localX],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (dragStartX.current === null) return;
      commitSelection(e.clientX);
    },
    [commitSelection],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): void => {
      if (dragStartX.current === null) return;
      commitSelection(e.clientX);
      dragStartX.current = null;
    },
    [commitSelection],
  );

  const onMouseLeave = useCallback((): void => {
    dragStartX.current = null;
  }, []);

  const altText =
    `Waveform of the encoded audio. Encoding: 300-baud KCS-derived FSK, ` +
    `1200 Hz represents bit 0 and 2400 Hz represents bit 1, ` +
    `8N2 framing, LSB-first. Total framed bits: ${totalBits}. ` +
    `Horizontal axis is time; vertical axis is signal amplitude.`;

  if (samples === null) {
    return (
      <p className="tg-waveform-empty">Encode audio to see its waveform.</p>
    );
  }

  return (
    <div className="tg-waveform">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="tg-waveform-canvas tg-focusable"
        role="img"
        aria-label={altText}
        tabIndex={0}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />
      {/* Redundant text alternative for screen readers and color-vision needs. */}
      <p className="tg-waveform-alt">{altText}</p>
    </div>
  );
}
