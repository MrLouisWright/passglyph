# Getting Started

## 1. Install

```bash
npm i passglyph
```

or `<script src="https://unpkg.com/passglyph"></script>` for `window.passglyph`.

## 2. Attach to your fields

```html
<label for="pw">New password</label>
<input id="pw" type="password" autocomplete="new-password">
<label for="pw2">Confirm password</label>
<input id="pw2" type="password" autocomplete="new-password">
```

```js
import { attach } from 'passglyph';
const detach = attach(document.getElementById('pw'), document.getElementById('pw2'));
```

The dots in both fields become hieroglyphs. When the rows match, the passwords match. When they don't, the first differing glyph marks the typo. Screen readers hear "Passwords match" or "Passwords don't match" once both fields have 8 characters.

## 3. React to the match state (optional)

```js
attach(pw, pw2, { onChange: (match) => { submit.disabled = match === false; } });
```

`match` is `true`, `false` or `null` (not enough input yet).

## 4. Choose the mode and bits (optional)

```js
attach(pw, pw2, { bits: 4 });            // 16 glyphs per position: leaks less, misses more typos at the exact position
attach(pw, pw2, { mode: 'badge' });      // v1: one PBKDF2 glyph beside each field, ≤ 12 bits total
```

## 5. Styling

Inline mode inherits the input's font, size, colour and padding. The overlay is drawn in the input's text colour. Glyph cells are `size` em wide (default `1.1`). passglyph only sets CSSOM properties (no `<style>`), so it's CSP-safe.

## 6. Clean up

Call `detach()` when the form goes away. It restores the inputs exactly. Frameworks: see [[Framework Usage]].

## Requirements and fallback

- A **secure context** (HTTPS or `localhost`) for WebCrypto. Without it, or without canvas, `Path2D` or `measureText`, passglyph leaves native dots and calls `onFallback(reason)`. It never uses `Math.random`.
