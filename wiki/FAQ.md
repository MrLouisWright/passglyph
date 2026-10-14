# FAQ

**Why hieroglyphs?**
They're a large, visually distinct set of signs that nobody reads as letters, and they're fun. 64 of them (U+13000–U+1342F) are bundled as a sprite. No font is needed and no code point goes into the page.

**Why does `aaaa` show four different glyphs?**
Because glyph *i* is a keyed hash of the whole prefix, not of character *i*. A per-character mapping would be a substitution cipher: repeated letters would show as repeated glyphs and reveal the password's structure. The demo's "unsafe" toggle shows this.

**Why do my glyphs change every time I reload?**
By design. A fresh random key per form means glyphs can't be linked to your password across sessions or sites. Compare the two rows on the page, don't memorise them.

**Does it show where my typo is?**
Yes, in inline mode. The rows agree up to the first wrong character and differ from there. That's also visible to onlookers (see [[Security Design]]). Badge mode doesn't show it.

**Can someone work out my password from a screenshot?**
Not without the 128-bit key, which exists only in that page's memory as a non-extractable `CryptoKey` and is discarded when you leave. **With** the key (which needs code running in the page, and that code could read the field directly), inline mode is close to full disclosure: about 5 bits per character, recoverable one position at a time. If that worries you, use `mode: 'badge'` (≤ 12 bits total, PBKDF2).

**Why only 5 bits per glyph?**
It's enough to catch a typo at its position 97 % of the time, and the following positions catch the rest. More bits would only increase what a key-holder learns, so 6 is the cap.

**Why are glyphs shown for short passwords in inline mode?**
Because dots are. A glyph replaces each dot and reveals nothing more without the key. The announcement still waits for `minLength`. (Badge mode shows a neutral glyph below `minLength`.)

**What happens with IME, paste, RTL or a long password?**
Composition shows native dots until it's committed. Paste draws all glyphs at once. `dir="rtl"` lays out from the right. Long passwords scroll, and the glyphs follow the caret.

**My browser doesn't support it.**
You get the normal dots, and `onFallback(reason)` tells you why.

**Does it work with password managers?**
Yes. Inputs aren't wrapped, moved or retyped (only a few CSSOM properties are set and restored on detach), and autofill `input`/`change` events update the glyphs. Generated passwords match as expected.

**Is it a password strength meter?**
No. Pair it with your own policy or a strength estimator.

**Does it protect against keyloggers or malicious scripts?**
No. Anything running on the page can read the password directly.

**Does it phone home or store anything?**
No network calls and no storage of any kind (enforced by tests).

**Will it work with my strict CSP?**
Yes. There are no inline `<style>`s, no style attributes in markup and no `eval`. The few sizing styles are set via the CSSOM, which `style-src` doesn't block. `unstyled: true` removes even those.

**Why canvas and not SVG in the DOM?**
SVG paths and fill colours in the DOM would expose the glyph (the derived bits) to DOM snapshots, session-replay tools and the accessibility tree. Hieroglyph text would be worse still (and needs a font most systems lack). Canvas pixels aren't serialised. The glyph sprites are path data drawn through `Path2D`.

**I only see dots on http://.**
WebCrypto only exists in secure contexts: serve over HTTPS or use `localhost`. In Node tests pass `crypto: require('node:crypto').webcrypto`.

**Chroma-Hash did this years ago. What's different?**
Chroma-Hash used a single MD5 with a static salt and showed many bits as colour bars, so it was stable across visits and in plain CSS. passglyph uses a per-instance random salt, PBKDF2, at most 12 bits, canvas only, an accessible announcement and non-colour cues. See the comparison in the README.
