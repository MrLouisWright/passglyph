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

A glyph appears after each field. Type at least 8 characters in both: the glyphs match when the passwords match, and screen readers hear "Passwords match".

## 3. React to the match state (optional)

```js
attach(pw, pw2, { onChange: (match) => { submit.disabled = match === false; } });
```

`match` is `true`, `false`, or `null` (not enough input yet).

## 4. Style it (optional)

passglyph sets a few layout properties through the CSSOM (size, small margin, visually hidden status). For full control:

```js
attach(pw, pw2, { unstyled: true });
```

```css
.passglyph-glyph { width: 20px; height: 20px; margin-inline-start: 8px; vertical-align: middle; }
.passglyph-mismatch { outline: 2px dashed #D55E00; }
.passglyph-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
```

## 5. Clean up

Call `detach()` when the form goes away. Frameworks: see [[Framework Usage]].

## Requirements

- A **secure context** (HTTPS or `localhost`), because WebCrypto `subtle` isn't available otherwise. `attach()` throws if WebCrypto is missing; it never falls back to `Math.random`.
- Canvas + `Path2D` for the glyph. Without them passglyph shows no glyph but keeps the accessible status.
