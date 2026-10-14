# Accessibility

## Glyphs are decorative to assistive tech

Each glyph is a `<canvas aria-hidden="true">` with no role, label or title. A spoken description ("blue hexagon with a dot") would expose derived bits to anything reading the accessibility tree, and would be slow to compare by ear anyway.

## The match state is announced

A visually hidden `<span role="status" aria-live="polite">` says:

- **"Passwords match"** once both fields have at least `minLength` characters and are equal
- **"Passwords don't match"** when both are long enough and differ
- nothing (empty) otherwise

It's announced after the debounce, only when the state changes, and politely, so it doesn't interrupt typing. Localise it with `labels: { match: '…', mismatch: '…' }`.

Place it next to your own error text with `mountStatus`, or point `aria-describedby` on the confirm input at it:

```js
attach(pw, pw2, { mountStatus: (el) => { el.id = 'pw-status'; pw2.setAttribute('aria-describedby', 'pw-status'); pw2.after(el); } });
```

## Not colour-only

- Palette: Okabe–Ito (orange, sky blue, bluish green, yellow, blue, vermillion, reddish purple, grey), distinguishable with the common colour-vision deficiencies.
- Shape (8), inner mark (4) and pips (4) all vary. At the default 10 bits, 128 glyphs differ with colour removed entirely (tested).
- The confirm glyph gets `passglyph-match` / `passglyph-mismatch` classes, so you can add a non-colour cue (outline style, icon, text) in your CSS.
- Every glyph has a 1.2 px outline in the field's text colour, so light fills stay visible on light backgrounds.

## Motion

There's no animation: the glyph changes once per pause in typing. No `prefers-reduced-motion` handling is needed.

## Keyboard, zoom, focus

passglyph adds no focusable elements and never moves focus. Glyphs are sized in CSS px and scale with zoom, and the canvas resolution follows `devicePixelRatio` (up to 3×).

## Checklist for your form

- Keep a visible `<label>` for both inputs.
- Keep your own submit-time "passwords don't match" error. The glyph is a hint.
- Don't describe the glyph in text anywhere on the page.
