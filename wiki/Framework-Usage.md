# Framework Usage

All wrappers are optional subpaths. `react` and `vue` are optional peer dependencies, and the core never imports them.

## Vanilla / any framework

```js
import { attach } from 'passglyph';
const detach = attach(pw, confirm, options);
// on teardown
detach();
```

## Web component

```js
import 'passglyph/element'; // registers <pass-glyph>
```

```html
<pass-glyph mode="inline" bits="5">
  <input type="password" autocomplete="new-password">
  <input type="password" autocomplete="new-password">
</pass-glyph>
```

It works in Svelte, Angular, Lit, Astro and plain HTML. Listen for `passglyph-change`:

```js
document.querySelector('pass-glyph').addEventListener('passglyph-change', (e) => console.log(e.detail.match));
```

No bundler? `<script src="https://unpkg.com/passglyph/dist/passglyph-element.global.js"></script>`.

## React

```jsx
import { useRef } from 'react';
import { usePassGlyph } from 'passglyph/react';

export function PasswordFields() {
  const pw = useRef(null), confirm = useRef(null);
  usePassGlyph(pw, confirm, { mode: 'inline', onChange: (m) => console.log(m) });
  return (
    <>
      <label htmlFor="pw">Password</label><input id="pw" ref={pw} type="password" autoComplete="new-password" />
      <label htmlFor="pw2">Confirm</label><input id="pw2" ref={confirm} type="password" autoComplete="new-password" />
    </>
  );
}
```

The hook re-attaches (with a fresh salt) when `mode`, `bits`, `minLength`, `iterations`, `size` or `debounce` change, and detaches on unmount. Use it in a client component in Next.js (`'use client'`).

## Vue 3

```vue
<script setup>
import { ref } from 'vue';
import { usePassGlyph } from 'passglyph/vue';
const pw = ref(null), confirm = ref(null);
usePassGlyph(pw, confirm, { bits: 5 });
</script>

<template>
  <input ref="pw" type="password" autocomplete="new-password" />
  <input ref="confirm" type="password" autocomplete="new-password" />
</template>
```

Or the directive, on a wrapper around two password inputs:

```js
import { vPassGlyph } from 'passglyph/vue';
app.directive('pass-glyph', vPassGlyph);
```

```html
<div v-pass-glyph="{ mode: 'inline' }"><input type="password"><input type="password"></div>
```

## SSR

Importing is safe on the server. `attach()` needs real DOM inputs and WebCrypto, so call it on mount only (the hooks already do).

## Tests (jsdom / Vitest / Jest)

```js
import { webcrypto } from 'node:crypto';
attach(pw, pw2, { crypto: webcrypto, debounce: 100, budget: 0, iterations: 10000 });
```

jsdom has no canvas, so passglyph falls back to dots (`onFallback('canvas')`) but the live region still updates. That's handy for asserting "Passwords match". For reproducible sequences in tests, pass `unsafeSalt` (never in production).
