# Accessibility

## The field stays a password field

In inline mode the `<input type="password">` is unchanged for assistive tech: same role, name, label, autocomplete and value. Screen readers announce it as a protected field and read characters as usual (or as "star"/"dot", depending on the reader). The hieroglyphs are a `<canvas aria-hidden="true">` overlay with `pointer-events: none`, so they never take focus or clicks.

## Glyphs are decorative to assistive tech

Overlays and badges have no role, label or title. A spoken description ("seated man, owl, reed…") would expose derived bits to anything reading the accessibility tree, and would be slow to compare by ear anyway.

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

## Inline glyphs are monochrome

Hieroglyphs are drawn in the input's own text colour, so they follow your theme, `forced-colors` and dark mode. They differ by shape only, and the 64 signs were chosen to be distinct at small sizes. They're drawn in cells of the input's font size (`size` em), so they scale with zoom and font-size changes (re-laid out via `ResizeObserver`).

## Badge mode: not colour-only

- Palette: Okabe–Ito (orange, sky blue, bluish green, yellow, blue, vermillion, reddish purple, grey), distinguishable with the common colour-vision deficiencies.
- Shape (8), inner mark (4) and pips (4) all vary. At the default 10 bits, 128 glyphs differ with colour removed entirely (tested).
- The confirm glyph gets `passglyph-match` / `passglyph-mismatch` classes, so you can add a non-colour cue (outline style, icon, text) in your CSS.
- Every glyph has a 1.2 px outline in the field's text colour, so light fills stay visible on light backgrounds.

## Motion

There's no animation in either mode. Inline glyphs appear exactly when the dot would, in one frame, with no per-key flourish. Badge glyphs change once per pause in typing. Reduced-motion users get the same static rendering.

## Keyboard, zoom, focus

passglyph adds no focusable elements and never moves focus. Glyphs are sized in CSS px and scale with zoom, and the canvas resolution follows `devicePixelRatio` (up to 3×).

## Checklist for your form

- Keep a visible `<label>` for both inputs.
- Keep your own submit-time "passwords don't match" error. The glyph is a hint.
- Don't describe the glyph in text anywhere on the page.
