# passglyph

**Spot a mistyped "confirm password" without showing the password.**

passglyph by [Louis Wright](https://github.com/MrLouisWright) draws a small glyph next to a password field and its confirmation. Same password, same glyph. Glyphs are salted fresh for every form, derived with PBKDF2, capped at 12 bits, drawn on canvas only, and backed by an accessible "Passwords match" announcement.

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
| Size | 2.8 KB min+gzip, zero dependencies |
| Formats | ESM, CJS, IIFE (`window.passglyph`), TypeScript types |
| Entry points | `passglyph`, `passglyph/element`, `passglyph/react`, `passglyph/vue` |
| Requires | WebCrypto (secure context), canvas + Path2D for the glyph |
