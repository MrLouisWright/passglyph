# passglyph

**Hieroglyphs instead of password dots: spot a mistyped "confirm password" where it happens, without showing the password.**

passglyph by [Louis Wright](https://github.com/MrLouisWright) replaces the masking dots in a password field and its confirm field with Egyptian hieroglyphs drawn on canvas. Same password, same row of glyphs. A typo changes the glyphs from the first wrong character on. Glyph *i* is a keyed HMAC of the prefix (no per-character mapping) under a per-instance non-extractable key, with 4–6 bits per glyph. The input stays `type="password"`, and if anything is unsupported passglyph falls back to dots. The v1 single-glyph **badge mode** is still available.

**[Live demo](https://mrlouiswright.github.io/passglyph/)** · [README](https://github.com/MrLouisWright/passglyph#readme) · [SECURITY-DESIGN.md](https://github.com/MrLouisWright/passglyph/blob/main/SECURITY-DESIGN.md)

## Pages

- [[Getting Started]]
- [[API]]
- [[Security Design]]
- [[Accessibility]]
- [[Framework Usage]]
- [[FAQ]]

## At a glance

| | |
|---|---|
| Size (min+gzip) | core 3.2 KB · hieroglyph sprite 3.8 KB (separate file) · badge alphabet 1.3 KB (separate file) · zero dependencies |
| Formats | ESM, CJS, IIFE (`window.passglyph`), TypeScript types |
| Entry points | `passglyph`, `passglyph/hieroglyphs`, `passglyph/glyph`, `passglyph/element`, `passglyph/react`, `passglyph/vue` |
| Modes | `inline` (default, hieroglyphs in the field) · `badge` (v1 glyph beside the field) |
| Requires | WebCrypto (secure context), canvas + Path2D. Otherwise native dots |
