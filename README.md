# passglyph

[![npm](https://img.shields.io/npm/v/passglyph.svg)](https://www.npmjs.com/package/passglyph)
[![CI](https://github.com/MrLouisWright/passglyph/actions/workflows/ci.yml/badge.svg)](https://github.com/MrLouisWright/passglyph/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![size](https://img.shields.io/badge/min%2Bgzip-2.8%20KB-success)
![zero deps](https://img.shields.io/badge/dependencies-0-success)
![types](https://img.shields.io/badge/types-included-blue)

> Spot a mistyped "confirm password" without showing the password.

**[Live demo →](https://mrlouiswright.github.io/passglyph/)** · [Docs (wiki)](https://github.com/MrLouisWright/passglyph/wiki) · [Security design](SECURITY-DESIGN.md) · [Launch post](docs/launch-post.md)

<p align="center"><img src="docs/hero.svg" alt="A password field and a confirm field with the same glyph, and a mistyped confirm field with a different glyph" width="760"></p>

`passglyph` draws a small glyph next to a password field and its confirm field. **Same password, same glyph**; a typo almost always changes it. Users catch mistakes before submitting, without "show password" and without a server round trip.

It revives the idea behind Chroma-Hash and HashMask (2009–13) with a design that doesn't leak:

- **Fresh 128-bit salt per form instance** (`crypto.getRandomValues`). Glyphs can't be compared across sessions or sites, and a screenshot is useless without the salt.
- **PBKDF2-SHA-256 (60,000 iterations) via WebCrypto**, debounced, with a non-extractable key. Derived bytes are zeroed after use.
- **Low, capped entropy**: 10 bits by default, configurable 4–12, **hard cap 12**.
- **Nothing for short input** and no per-keystroke animation. The repaint lands at a fixed deadline.
- **Canvas only**: no derived bits in the DOM. Glyphs are `aria-hidden`, and a polite live region announces "Passwords match".
- **No network, no storage, no `<style>` injection, no eval**, so it works under a strict CSP. Autofill and password managers work as usual.
- Colour-blind-safe Okabe–Ito palette, and **shape + inner mark** distinguish glyphs too, so colour is never the only cue.

2.8 KB min+gzip, zero dependencies, TypeScript types, ESM + CJS + IIFE. Vanilla JS, a `<pass-glyph>` web component, and React and Vue wrappers.

## Install

```bash
npm i passglyph
```

CDN: `<script src="https://unpkg.com/passglyph"></script>` → `window.passglyph.attach(...)`.

## Usage

### Vanilla

```js
import { attach } from 'passglyph';

const detach = attach(
  document.querySelector('#password'),
  document.querySelector('#confirm'),
  { bits: 10, onChange: (match) => submit.disabled = match === false },
);
// later: detach();
```

### Web component

```html
<script type="module">import 'passglyph/element';</script>

<pass-glyph bits="10" min-length="8">
  <input type="password" autocomplete="new-password">
  <input type="password" autocomplete="new-password">
</pass-glyph>

<!-- or point it at existing inputs -->
<pass-glyph for="password" confirm="confirm"></pass-glyph>
```

It fires `passglyph-change` with `event.detail.match` (`true` / `false` / `null`).

### React

```jsx
import { useRef } from 'react';
import { usePassGlyph } from 'passglyph/react';

function SignUp() {
  const pw = useRef(null), confirm = useRef(null);
  usePassGlyph(pw, confirm, { bits: 10 });
  return <><input ref={pw} type="password" /><input ref={confirm} type="password" /></>;
}
```

### Vue 3

```vue
<script setup>
import { ref } from 'vue';
import { usePassGlyph, vPassGlyph } from 'passglyph/vue';
const pw = ref(), confirm = ref();
usePassGlyph(pw, confirm);
</script>
<template>
  <input ref="pw" type="password" /><input ref="confirm" type="password" />
  <!-- or: <div v-pass-glyph="{ bits: 10 }"><input type="password"><input type="password"></div> -->
</template>
```

`react` and `vue` are optional peer dependencies. The wrappers are separate subpaths, so the core never imports them.

## API

### `attach(password, confirm, options?) → detach()`

| Option | Default | Description |
|---|---|---|
| `bits` | `10` | Bits of entropy shown, **4–12** (values above 12 are clamped) |
| `minLength` | `8` | Below this length a fixed neutral glyph is shown and nothing is announced (minimum 4) |
| `iterations` | `60000` | PBKDF2 iterations (minimum 10,000) |
| `debounce` | `300` | ms of quiet before updating (minimum 100) |
| `budget` | `250` | Fixed repaint budget after the debounce, so timing doesn't depend on input |
| `size` | `20` | Glyph size in CSS px |
| `unstyled` | `false` | Set no CSSOM styles; style `.passglyph-glyph` / `.passglyph-sr` yourself |
| `labels` | `{ match: 'Passwords match', mismatch: "Passwords don't match" }` | Live-region text (localise here) |
| `onChange` | — | `(match: boolean \| null) => void` after each settled update |
| `mount` | after input | `(input, canvas, 'password' \| 'confirm') => void` to place glyphs |
| `mountStatus` | after confirm glyph | `(statusEl) => void` to place the live region |
| `crypto` | `globalThis.crypto` | WebCrypto implementation |

DOM added: one `<canvas class="passglyph-glyph" aria-hidden="true">` per input (the confirm glyph also gets `passglyph-match` / `passglyph-mismatch`) and one `<span class="passglyph-sr" role="status" aria-live="polite">`. `detach()` removes all of it.

### Lower level

| Export | Description |
|---|---|
| `createSalt(crypto?)` | `"passglyph/v1"` ‖ 16 random bytes; throws without a CSPRNG |
| `deriveIndex(value, salt, bits, iterations, crypto?)` | PBKDF2 → glyph index `< 2^bits` |
| `glyphOps(index, bits, ink?)`, `neutralOps(ink?)` | Glyph drawing ops (SVG path data) |
| `paint(ctx, Path2D, ops, size, dpr)` | Draw ops on a canvas |
| `opsToSVG(ops, size?)` | SVG markup for **legends and docs only**; live glyphs are never SVG in the DOM |
| `clampBits`, `decompose`, `COLOURS`, `SHAPES`, `MAX_BITS` | Building blocks |

## The trade-off, in numbers

| bits | glyphs | typo goes unnoticed | worst case, *if the salt were stolen* |
|---|---|---|---|
| 8 | 256 | 0.39 % | guesses ÷ 256 |
| **10** | **1,024** | **0.098 %** | **guesses ÷ 1,024** |
| 12 (cap) | 4,096 | 0.024 % | guesses ÷ 4,096 |

Without the salt (screenshots, shoulder surfing, screen recordings, DOM snapshots) the glyph tells an attacker **nothing** about the password. See [SECURITY-DESIGN.md](SECURITY-DESIGN.md) for the full threat model.

## Compared

| | passglyph | Chroma-Hash | hashmask |
|---|---|---|---|
| Last activity | 2026 | 2018 (jQuery plugin, 2009 idea) | 2013 (Chrome extension; Arc90 demo 2009) |
| Per-session random salt | ✔ 128-bit | ✖ static developer-set salt (same colours every visit) | ✖ stable by design (to aid memorability) |
| Slow keyed derivation | ✔ PBKDF2 60k | ✖ single MD5 | ✖ fast hash |
| Entropy shown | 4–12 bits, capped | 1–4 colour bars, 12 bits each (4-bit components) | not capped |
| Nothing derived in DOM | ✔ canvas only | ✖ CSS colours | ✖ |
| Accessible match announcement | ✔ | ✖ | ✖ |
| Not colour-only | ✔ shape + mark | ✖ | partial |
| Short-input & timing protection | ✔ | ✖ | ✖ |
| CSP-safe, zero deps | ✔ | jQuery | ✖ |
| Web component / React / Vue | ✔ | ✖ | ✖ |

## Limitations

- **Not a strength meter.** Matching says nothing about strength.
- **No protection against keyloggers, malicious extensions, XSS or compromised scripts on the page**: they can read the input directly.
- It's a hint, not verification. Still compare on submit (false-match rate 2^-bits).
- The glyph changes on every page load, by design. Users shouldn't learn "their" glyph.
- Without `<canvas>` it fails closed: no glyph, just the accessible status.

## Browser support

Every browser with WebCrypto `subtle`, `Path2D` and canvas: all current evergreen browsers. WebCrypto requires a secure context (HTTPS or localhost). On Node 18, pass `crypto: require('node:crypto').webcrypto` (only relevant for tests).

## Releasing

Publish a GitHub release for tag `vX.Y.Z`: `release.yml` tests, then publishes to GitHub Packages as `@mrlouiswright/passglyph`, and to npm with provenance once the `NPM_PUBLISH` repository variable is `true`.

## Support

If this project is useful to you, you can support its development with a donation: [Buy me a coffee](https://donate.stripe.com/aFa00lek3cvX4Ds2Fk9EI0b). It helps keep these tools maintained, documented and free for everyone.

## License

MIT © Louis Wright ([Louis Wright](https://github.com/MrLouisWright))
