# FAQ

**Why does my glyph change every time I reload?**
By design. A fresh random salt per form means a glyph can't be linked to your password across sessions or sites. Compare the two glyphs on the page, don't memorise them.

**Can someone work out my password from a screenshot?**
Not without the 128-bit salt, which exists only in that page's memory and is discarded when you leave. With the salt, which needs code running in the page (and that code could read the field directly), a glyph narrows guesses by at most 2^bits: ÷1,024 by default, ÷4,096 at the cap, and every guess costs 60,000 PBKDF2 iterations.

**Why only 10 bits? Wouldn't more be safer for typo detection?**
At 10 bits a typo goes unnoticed about 0.1 % of the time, and you still validate on submit. More bits barely improve that while increasing the worst-case leak, so 12 is a hard cap.

**Why is nothing shown for short passwords?**
Short strings are cheap to brute force, and showing glyphs for prefixes would leak more. Below `minLength` (8 by default) every value shows the same neutral glyph.

**Does it work with password managers?**
Yes. Inputs aren't wrapped, moved or modified, and autofill `input`/`change` events update the glyph. Generated passwords match as expected.

**Is it a password strength meter?**
No. Pair it with your own policy or a strength estimator.

**Does it protect against keyloggers or malicious scripts?**
No. Anything running on the page can read the password directly.

**Does it phone home or store anything?**
No network calls and no storage of any kind (enforced by tests).

**Will it work with my strict CSP?**
Yes. There are no inline `<style>`s, no style attributes in markup and no `eval`. The few sizing styles are set via the CSSOM, which `style-src` doesn't block. `unstyled: true` removes even those.

**Why canvas and not SVG in the DOM?**
SVG paths and fill colours in the DOM would expose the glyph (the derived bits) to DOM snapshots, session-replay tools and the accessibility tree. Canvas pixels aren't serialised. The glyph *designs* are SVG path data, drawn through `Path2D`.

**It throws "WebCrypto is required".**
WebCrypto only exists in secure contexts: serve over HTTPS or use `localhost`. In Node tests pass `crypto: require('node:crypto').webcrypto`.

**Chroma-Hash did this years ago. What's different?**
Chroma-Hash used a single MD5 with a static salt and showed many bits as colour bars, so it was stable across visits and in plain CSS. passglyph uses a per-instance random salt, PBKDF2, at most 12 bits, canvas only, an accessible announcement and non-colour cues. See the comparison in the README.
