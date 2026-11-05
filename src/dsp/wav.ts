/**
 * RIFF/WAVE builder (encoder side) and parser (decoder side, Task 10).
 *
 * Output format: RIFF/WAVE, format tag 1 (PCM), mono, signed 16-bit LE, 48 kHz.
 * 44-byte canonical header, no metadata, no dither.
 */

import type { TghoError } from './errors';

export interface WavData {
  readonly samples: Int16Array;
  readonly sampleRate: 44100 | 48000;
}

/**
 * Build a complete RIFF/WAVE file (44-byte header + PCM samples) as an ArrayBuffer.
 * sampleRate must be 48000 for encoding.
 */
export function buildWav(samples: Int16Array, sampleRate: 48000): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const totalSize = 44 + dataBytes;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true); // ChunkSize
  writeAscii(view, 8, 'WAVE');

  // fmt subchunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (PCM)
  view.setUint16(20, 1, true); // AudioFormat = PCM
  view.setUint16(22, 1, true); // NumChannels = mono
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate = sampleRate * blockAlign
  view.setUint16(32, 2, true); // BlockAlign = channels * bitsPerSample/8
  view.setUint16(34, 16, true); // BitsPerSample

  // data subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true); // Subchunk2Size

  // PCM sample data (little-endian signed 16-bit)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return buffer;
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

const MAX_WAV_BYTES = 8 * 1024 * 1024; // 8 MiB
const MAX_DURATION_SECONDS = 60;

function readAscii(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

/**
 * Parse a RIFF/WAVE file into samples + sampleRate, with full bounds checking.
 * Returns WavData on success or a TghoError on any validation failure.
 * Does NOT assume a fixed 44-byte header; traverses chunks within the RIFF extent.
 */
export function parseWav(buffer: ArrayBuffer): WavData | TghoError {
  // 1. Size check
  if (buffer.byteLength > MAX_WAV_BYTES) {
    return { kind: 'oversized-file', byteCount: buffer.byteLength };
  }
  // 2. Minimum RIFF header
  if (buffer.byteLength < 12) {
    return { kind: 'unsupported-wav-profile', detail: 'file too small to be RIFF/WAVE' };
  }
  const view = new DataView(buffer);
  // 3. RIFF signature
  if (readAscii(view, 0, 4) !== 'RIFF') {
    return { kind: 'unsupported-wav-profile', detail: 'missing RIFF signature' };
  }
  if (readAscii(view, 8, 4) !== 'WAVE') {
    return { kind: 'unsupported-wav-profile', detail: 'missing WAVE signature' };
  }
  // 4. RIFF extent
  const riffSize = view.getUint32(4, true);
  const riffExtent = Math.min(buffer.byteLength, riffSize + 8);

  // 5. Chunk traversal
  let pos = 12;
  let fmtParsed = false;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let blockAlign = 0;
  let byteRate = 0;
  let dataOffset = -1;
  let dataByteCount = -1;

  while (pos + 8 <= riffExtent) {
    const chunkId = readAscii(view, pos, 4);
    const chunkSize = view.getUint32(pos + 4, true);
    const bodyStart = pos + 8;
    if (bodyStart + chunkSize > riffExtent) {
      return { kind: 'unsupported-wav-profile', detail: 'chunk extends beyond RIFF extent' };
    }
    if (chunkId === 'fmt ') {
      if (fmtParsed) {
        return { kind: 'unsupported-wav-profile', detail: 'duplicate fmt chunk' };
      }
      if (chunkSize < 16) {
        return { kind: 'unsupported-wav-profile', detail: 'fmt chunk too small' };
      }
      audioFormat = view.getUint16(bodyStart, true);
      numChannels = view.getUint16(bodyStart + 2, true);
      sampleRate = view.getUint32(bodyStart + 4, true);
      byteRate = view.getUint32(bodyStart + 8, true);
      blockAlign = view.getUint16(bodyStart + 12, true);
      bitsPerSample = view.getUint16(bodyStart + 14, true);
      fmtParsed = true;
    } else if (chunkId === 'data') {
      if (!fmtParsed) {
        return { kind: 'unsupported-wav-profile', detail: 'fmt chunk must precede data chunk' };
      }
      dataOffset = bodyStart;
      dataByteCount = chunkSize;
      break; // stop at data
    }
    // advance with odd-byte padding
    const advance = 8 + chunkSize + (chunkSize % 2);
    pos += advance;
  }

  // 6. Required chunks
  if (!fmtParsed) {
    return { kind: 'unsupported-wav-profile', detail: 'fmt chunk missing' };
  }
  if (dataOffset < 0) {
    return { kind: 'unsupported-wav-profile', detail: 'data chunk missing' };
  }

  // 7. fmt validation
  if (audioFormat !== 1) {
    return { kind: 'unsupported-wav-profile', detail: `unsupported format tag: ${audioFormat}` };
  }
  if (numChannels !== 1) {
    return {
      kind: 'unsupported-wav-profile',
      detail: `${numChannels === 2 ? 'stereo' : 'multi-channel'} audio: ${numChannels} channels`,
    };
  }
  if (sampleRate !== 44100 && sampleRate !== 48000) {
    return { kind: 'unsupported-wav-profile', detail: `unsupported sample rate: ${sampleRate}` };
  }
  if (bitsPerSample !== 16) {
    return { kind: 'unsupported-wav-profile', detail: `unsupported bit depth: ${bitsPerSample}` };
  }
  if (blockAlign !== 2) {
    return { kind: 'unsupported-wav-profile', detail: `unexpected BlockAlign: ${blockAlign}` };
  }
  if (byteRate !== sampleRate * 2) {
    return { kind: 'unsupported-wav-profile', detail: `unexpected ByteRate: ${byteRate}` };
  }

  // 8. Even data size
  if (dataByteCount % 2 !== 0) {
    return { kind: 'unsupported-wav-profile', detail: 'odd data chunk size' };
  }

  // 9. Duration check
  const sampleCount = dataByteCount / 2;
  const duration = sampleCount / sampleRate;
  if (duration > MAX_DURATION_SECONDS) {
    return {
      kind: 'unsupported-wav-profile',
      detail: `audio duration exceeds 60 seconds: ${duration.toFixed(2)}s`,
    };
  }

  // 10. Sample data bounds
  if (dataOffset + dataByteCount > buffer.byteLength) {
    return { kind: 'truncation' };
  }

  // 11. Return samples as a copy (not a view) to avoid alignment issues and
  // to let the caller own a standalone typed array.
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true);
  }
  return { samples, sampleRate: sampleRate as 44100 | 48000 };
}
