# Changelog

## 1.0.0 (2026-10-14)

First release.

- `attach(password, confirm, options)` → `detach()`: matching canvas glyphs plus an accessible match announcement.
- Fresh 128-bit salt per instance, PBKDF2-SHA-256 (60,000 iterations, minimum 10,000) via WebCrypto, 4–12 bits shown (hard cap 12, default 10).
- Neutral glyph below `minLength` (default 8), debounced fixed-deadline repaint, nothing derived in the DOM, no network or storage, CSP-safe.
- Okabe–Ito palette with shape + mark + pips + frame, so colour is never the only cue.
- `<pass-glyph>` web component (`passglyph/element`), React hook (`passglyph/react`), Vue composable and directive (`passglyph/vue`).
- 2.8 KB min+gzip core, zero dependencies, TypeScript types, ESM + CJS + IIFE.
