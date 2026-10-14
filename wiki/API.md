# API

## `attach(password, confirm, options?) → detach`

| Option | Type | Default | Notes |
|---|---|---|---|
| `bits` | `number` | `10` | 4–12; values above 12 are clamped to 12 (hard cap) |
| `minLength` | `number` | `8` | ≥ 4. Below it: neutral glyph, no announcement |
| `iterations` | `number` | `60000` | PBKDF2 iterations, ≥ 10,000 |
| `debounce` | `number` | `300` | ms of quiet before an update, ≥ 100 |
| `budget` | `number` | `250` | Fixed extra delay so repaint timing is input-independent |
| `size` | `number` | `20` | CSS px |
| `unstyled` | `boolean` | `false` | No CSSOM styles at all |
| `labels` | `{ match?, mismatch? }` | English | Live-region text |
| `onChange` | `(m: boolean \| null) => void` | — | After each settled update |
| `mount` | `(input, canvas, which) => void` | after input | Custom glyph placement |
| `mountStatus` | `(el) => void` | after confirm glyph | Custom live-region placement |
| `crypto` | `Crypto` | `globalThis.crypto` | e.g. `require('node:crypto').webcrypto` in tests |

Returns `detach()`, which removes listeners, canvases and the live region, and cancels pending updates.

### DOM contract

```html
<input type="password"><canvas class="passglyph-glyph" aria-hidden="true" width="40" height="40"></canvas>
<input type="password"><canvas class="passglyph-glyph passglyph-match" aria-hidden="true" ...></canvas>
<span class="passglyph-sr" role="status" aria-live="polite">Passwords match</span>
```

Nothing else, and nothing password-derived (see [[Security Design]]).

## `<pass-glyph>` (`passglyph/element`)

| Attribute | Maps to |
|---|---|
| `bits` | `bits` |
| `min-length` | `minLength` |
| `iterations` | `iterations` |
| `for` + `confirm` | ids of the two inputs (otherwise the first two `input[type=password]` children) |

Property `options` takes any other option. Event `passglyph-change` has `detail.match`. `defineElement(name?, registry?)` registers under another name.

## Low-level exports

| Export | Signature |
|---|---|
| `createSalt` | `(crypto?) → Uint8Array` (28 bytes: `passglyph/v1` + 16 random) |
| `deriveIndex` | `(value, salt, bits?, iterations?, crypto?) → Promise<number>` |
| `glyphOps` | `(index, bits, ink?) → Op[]` |
| `neutralOps` | `(ink?) → Op[]` |
| `paint` | `(ctx, Path2D, ops, size, dpr?)` |
| `opsToSVG` | `(ops, size?) → string`, for legends/docs only |
| `clampBits` | `(n) → 4..12` |
| `decompose` | `(index, bits) → { shape, colour, mark, pips, frame }` |
| `COLOURS`, `SHAPES`, `SHAPE_NAMES`, `MAX_BITS`, `MIN_BITS`, `MIN_ITERATIONS`, `DEFAULT_ITERATIONS` | constants |

## Glyph alphabet

Bits are spent in this order: **shape** (3 bits: circle, square, triangle, diamond, pentagon, hexagon, star, plus) → **colour** (3: Okabe–Ito) → **inner mark** (2: none, dot, bar, ring) → **pips** (2: 0–3 dots) → **frame** (2: none, rounded square, circle, corner ticks).
