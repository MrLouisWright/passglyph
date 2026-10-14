# API

## `attach(password, confirm, options?) → detach`

| Option | Type | Default | Notes |
|---|---|---|---|
| `mode` | `'inline' \| 'badge'` | `'inline'` | Hieroglyphs in the field, or the v1 glyph beside it |
| `bits` | `number` | inline `5`, badge `10` | Inline: per position, 4–6. Badge: total, 4–12. Clamped |
| `minLength` | `number` | `8` | ≥ 4. Gates the announcement (badge: also the glyph) |
| `debounce` | `number` | `300` | ms before the announcement (badge: repaint), ≥ 100 |
| `size` | `number` | inline `1.1` em, badge `20` px | Glyph cell / badge size |
| `iterations` | `number` | `60000` | Badge only. PBKDF2, ≥ 10,000 |
| `budget` | `number` | `250` | Badge only. Fixed repaint deadline |
| `unstyled` | `boolean` | `false` | No badge styles; live region not hidden |
| `labels` | `{ match?, mismatch? }` | English | Live-region text |
| `onChange` | `(m: boolean \| null) => void` | — | Match state |
| `onFallback` | `(reason: 'canvas' \| 'webcrypto') => void` | — | Native dots kept |
| `mount` / `mountStatus` | functions | — | Placement of badge canvases / live region |
| `crypto` | `Crypto` | `globalThis.crypto` | e.g. `require('node:crypto').webcrypto` in tests |
| `unsafeSalt` | `Uint8Array` | — | **Testing only**: reproducible sequences |

### DOM contract (inline)

```html
<input type="password" style="color: transparent; -webkit-text-fill-color: transparent; caret-color: …; letter-spacing: …px">
<canvas class="passglyph-overlay" aria-hidden="true"></canvas>
<!-- same for confirm -->
<span class="passglyph-sr" role="status" aria-live="polite">Passwords match</span>
```

The styles are set via CSSOM, not markup. Nothing in the DOM depends on the password except the match text. There are no code points and no path data. `detach()` restores the original inline styles exactly.

## `<pass-glyph>` (`passglyph/element`)

| Attribute | Maps to |
|---|---|
| `mode` | `mode` |
| `bits` | `bits` |
| `min-length` | `minLength` |
| `iterations` | `iterations` |
| `for` + `confirm` | ids of the two inputs (otherwise the first two `input[type=password]` children) |

Property `options` takes any other option. Event `passglyph-change` has `detail.match`. `defineElement(name?, registry?)` registers under another name.

## Low-level exports

| Export | Signature |
|---|---|
| `createSalt` | `(crypto?) → Uint8Array` (28 bytes: `passglyph/v1` + 16 random) |
| `instanceKey` | `(salt, crypto?) → Promise<CryptoKey>`, non-extractable HMAC-SHA-256; zero-fills `salt` |
| `glyphSequence` | `(key, value, bits?, crypto?) → Promise<number[]>`, one index per code point |
| `clampGlyphBits` | `(n) → 4..6` |
| `hieroglyphPath` | `(i) → string`, path data in a 32×32 box (`passglyph/hieroglyphs`) |
| `HIEROGLYPH_COUNT`, `CODEPOINTS` | `64`; the code points (build-time reference, never put in the DOM) |
| `deriveIndex`, `glyphOps`, `neutralOps`, `paint`, `opsToSVG`, `clampBits`, `decompose` | Badge mode (`passglyph/glyph`) |
