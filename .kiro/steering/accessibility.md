# Accessibility steering — TapeGhost

## Standard and target

WCAG 2.1 AA as the target. Full validation requires manual testing with assistive technologies; automated checks are a supplement, not a replacement.

## Semantic HTML rules

- Use native HTML elements wherever possible: `<button>`, `<input>`, `<label>`, `<progress>`, `<a>`.
- All interactive controls must have an associated `<label>` or `aria-label`.
- Status and error regions must use `role="status"` or `role="alert"` as appropriate.
- ARIA live regions: `aria-live="polite"` for success outcomes, `aria-live="assertive"` for errors.

## Keyboard operation

- Every user action (encode, decode, download, playback, clear, bit-region selection) must be reachable and activatable via Tab + Enter/Space with no pointing device.
- Tab order must follow the logical top-to-bottom, left-to-right page reading sequence.
- No interactive element may be skipped or unreachable via Tab.
- The bit-inspection region selector must have a keyboard-operable equivalent (e.g., labeled numeric start/end inputs or a range-slider pair) in addition to the canvas drag interaction.

## Focus indicators

- Every focusable element must have a visible focus indicator.
- Minimum: 2 CSS pixel perimeter outline, 3:1 contrast ratio against adjacent background (WCAG 2.1 SC 1.4.11 non-text contrast).

## Color and modality

- All information conveyed by color (success/error state, bit value) must also be conveyed by text label or icon with accessible text alternative.
- No essential function may depend on audio playback. All encode, decode, and error-reporting behavior must work in silence.
- Waveform and bit-inspection visualizations must provide a text alternative that states the bit sequence, signal levels, and time-axis scale.

## Viewport

- Minimum usable viewport width: 360 px. No horizontal scrolling of essential content at 360 px.
- All interactive controls, status messages, and instructional text must remain visible and operable at 360 px.

## Motion

- `prefers-reduced-motion: reduce` must suppress all CSS transitions, animations, and JavaScript-driven motion in the UI and waveform display.

## Manual check required before release

Essential understanding of the encode/decode pipeline must not depend on hearing or color vision. This must be verified by a manual keyboard-only walkthrough before M3 is marked complete.
