# Changelog

## 2.0.0 (2026-10-14)

Egyptian hieroglyphs replace the masking dots.

### Breaking
- `attach()` defaults to `mode: 'inline'`. Pass `mode: 'badge'` for v1 behaviour.
- In inline mode `bits` means bits per position (4–6, default 5).
- With no WebCrypto, passglyph now falls back to native dots and calls `onFallback('webcrypto')` instead of throwing.

### Added
- **Inline mode:** glyph *i* = HMAC-SHA-256(per-instance non-extractable key, prefix[0..i]) truncated to b bits. There's no per-character mapping, so repeated characters don't repeat glyphs and a typo shows from its position on.
- Canvas overlay (`aria-hidden`) aligned with the caret through `letter-spacing`. It follows scrolling, selection, paste, IME (dots during composition), RTL, font-size changes and resizing. The input stays `type="password"`.
- 64-sign hieroglyph sprite (U+13000–U+1342F, from Noto Sans Egyptian Hieroglyphs, OFL-1.1) as a separate asset `passglyph/hieroglyphs`, drawn via Path2D. No code points in the DOM.
- `onFallback`, `unsafeSalt` (testing only), `instanceKey`, `glyphSequence`, `hieroglyphPath`, and `<pass-glyph mode>`.
- Badge alphabet split into `passglyph/glyph`. Core is 3.2 KB gz.
- Demo: hieroglyph inputs, a bits slider, and a toggle that shows why per-character mapping is unsafe.
- SECURITY-DESIGN.md v2 with the leak quantified.

## 1.0.0 (2026-10-14)

First release.

- `attach(password, confirm, options)` → `detach()`: matching canvas glyphs plus an accessible match announcement.
- Fresh 128-bit salt per instance, PBKDF2-SHA-256 (60,000 iterations, minimum 10,000) via WebCrypto, 4–12 bits shown (hard cap 12, default 10).
- Neutral glyph below `minLength` (default 8), debounced fixed-deadline repaint, nothing derived in the DOM, no network or storage, CSP-safe.
- Okabe–Ito palette with shape + mark + pips + frame, so colour is never the only cue.
- `<pass-glyph>` web component (`passglyph/element`), React hook (`passglyph/react`), Vue composable and directive (`passglyph/vue`).
- 2.8 KB min+gzip core, zero dependencies, TypeScript types, ESM + CJS + IIFE.
