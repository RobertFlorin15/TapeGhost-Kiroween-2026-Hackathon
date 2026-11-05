/**
 * Discriminated union error types for the TapeGhost DSP layer.
 * Single source of truth — all modules import TghoError from here.
 */

export type TghoError =
  | { readonly kind: 'oversized-file'; readonly byteCount: number }
  | { readonly kind: 'unsupported-wav-profile'; readonly detail: string }
  | { readonly kind: 'no-carrier' }
  | { readonly kind: 'sync-failure' }
  | { readonly kind: 'framing-error' }
  | { readonly kind: 'magic-mismatch' }
  | { readonly kind: 'unsupported-version'; readonly version: number }
  | { readonly kind: 'unknown-kind'; readonly value: number }
  | { readonly kind: 'filename-length-overflow'; readonly length: number }
  | { readonly kind: 'payload-length-overflow'; readonly length: number }
  | { readonly kind: 'truncation' }
  | { readonly kind: 'crc-mismatch' }
  | { readonly kind: 'utf8-encoding-error' }
  | { readonly kind: 'filename-in-text-envelope' }
  | { readonly kind: 'internal-error'; readonly detail: string };

/** Type guard: is this value a TghoError? */
export function isTghoError(value: unknown): value is TghoError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

export function formatError(err: TghoError): string {
  switch (err.kind) {
    case 'oversized-file':
      return `File too large: ${err.byteCount.toLocaleString()} bytes (max 8 MiB)`;
    case 'unsupported-wav-profile':
      return `Unsupported WAV profile: ${err.detail}`;
    case 'no-carrier':
      return 'No carrier tone detected in audio';
    case 'sync-failure':
      return 'Synchronization failed: no valid symbol alignment found after carrier';
    case 'framing-error':
      return 'Framing error: invalid stop bit or ambiguous symbol detected';
    case 'magic-mismatch':
      return 'Format error: TGHO magic bytes not found';
    case 'unsupported-version':
      return `Unsupported envelope version: ${err.version}`;
    case 'unknown-kind':
      return `Unknown content kind: ${err.value}`;
    case 'filename-length-overflow':
      return `Filename too long: ${err.length} bytes (max 64)`;
    case 'payload-length-overflow':
      return `Payload too large: ${err.length} bytes (max 1024)`;
    case 'truncation':
      return 'Truncated envelope: not enough bytes received';
    case 'crc-mismatch':
      return 'CRC mismatch: data may be corrupted';
    case 'utf8-encoding-error':
      return 'Payload is not valid UTF-8 text';
    case 'filename-in-text-envelope':
      return 'Format error: filename field must be empty for text (Kind=0) envelopes';
    case 'internal-error':
      return `Internal error: ${err.detail}`;
  }
}
