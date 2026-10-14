---
title: "passglyph: catch the confirm-password typo without leaking the password"
author: Louis Wright
status: draft
---

# passglyph: catch the confirm-password typo without leaking the password

Every sign-up form asks you to type your new password twice, and then hides both copies behind dots. If they don't match you find out on submit, and if they *both* contain the same typo you find out next week. "Show password" toggles fix that by putting the password on screen, where cameras, screen-shares and the person next to you can see it.

In 2009 Arc90's HashMask and then Chroma-Hash had a lovely idea: hash what's in the field and show the hash as colours. Same password, same colours. Hackers had a lovely response: if the colours are a stable function of the password, then a screenshot of the colours is a fingerprint you can brute-force offline, or recognise on another site.

**passglyph** keeps the idea and fixes the leak. Here's how, and where its limits are.

## The idea in one sentence

passglyph draws a small glyph next to the password field and the confirm field. If the two glyphs are the same, the passwords are (almost certainly) the same.

```js
import { attach } from 'passglyph';
const detach = attach(passwordInput, confirmInput);
```

## 1. A salt nobody else will ever see

Every form instance gets a fresh 128-bit salt from `crypto.getRandomValues`. The password field and its confirm field share it, which is the only thing that makes them comparable. Every other page load, tab and site gets a different one.

The salt never leaves a JavaScript closure: it's not in the DOM, storage, the network or a global. So the glyph is a function of your password **and a secret 128-bit number that's discarded when you leave the page**. A screenshot of a glyph is meaningless on its own, and the same password shows a different glyph tomorrow. Old tools did the opposite on purpose (one even sold stable glyphs as a memory aid), and that's exactly what made them leak.

## 2. Slow on purpose

The glyph comes from PBKDF2-HMAC-SHA-256 with 60,000 iterations through WebCrypto. That's about 15–60 ms on current hardware, which is fine for a field you've just stopped typing in. The key is imported non-extractable, only 32 bits are derived, and the buffer is zeroed straight after. Updates are debounced (300 ms), so nothing is derived while you type.

## 3. Show as little as possible

How many bits should a glyph show? Two numbers pull in opposite directions:

| bits | glyphs | typo goes unnoticed | worst case, if the salt leaked too |
|---|---|---|---|
| 8 | 256 | 0.39 % | guesses ÷ 256 |
| **10 (default)** | **1,024** | **0.098 %** | **guesses ÷ 1,024** |
| 12 (hard cap) | 4,096 | 0.024 % | guesses ÷ 4,096 |

Typo detection needs "probably different", not "certainly different". At 10 bits a typo slips through about one time in a thousand, and since you still compare on submit, that just means the old behaviour. On the other side, the leak is **zero bits** for anyone without the salt. Even for an attacker who somehow has it (who can then read the input anyway), a glyph narrows the search by at most 2^10, and each remaining guess costs 60,000 HMACs. A 40-bit password has 30 bits left; a strong one stays strong.

Above 12 bits the typo benefit is noise (0.024 % → 0.006 %) while the worst-case leak keeps growing, so 12 is a hard cap: `bits: 64` gives you 12.

## 4. Don't leak length or rhythm

- Under 8 characters you get the same neutral glyph for every value, empty included.
- No animation per keystroke, no blanking while typing. The glyph changes once, after you pause.
- Each settled input does the same work (short values are derived too, then thrown away), and the repaint lands at a **fixed deadline** after your last keystroke. Watching *when* the glyph changes tells you nothing about the password.

## 5. Nothing derived in the DOM

Glyphs are painted on a `<canvas aria-hidden="true">`. There's no SVG path, colour value, class or data attribute that depends on the password. Our test suite serialises the whole document for two different passwords and asserts it's **byte-for-byte identical**. Session-replay tools, DOM snapshots in bug reports and accessibility-tree dumps see nothing.

A glyph is useless to a screen reader anyway, so passglyph announces the one thing that matters through a polite live region: "Passwords match" or "Passwords don't match", only when both fields are long enough. That single bit is what any confirm-password error message already reveals.

The glyphs use the Okabe–Ito colour-blind-safe palette, and **shape, inner mark, pips and frame** carry information too. At 10 bits, 128 glyphs are distinguishable with no colour at all.

## 6. Boring in the best way

No network calls and no storage (both trapped in tests). No `<style>` injection, no `style="..."` markup and no `eval`, so it runs under `script-src 'self'; style-src 'self'`. The demo page itself ships a CSP with `script-src 'self'`, `connect-src 'none'` and `form-action 'none'`. Inputs aren't wrapped, moved or retyped, so password managers and autofill just work.

2.8 KB min+gzip, zero dependencies, TypeScript, ESM + CJS. There's a `<pass-glyph>` web component, `usePassGlyph` for React, and a composable and directive for Vue.

## What it isn't

- **Not a strength meter.** Two matching copies of `password1` match perfectly.
- **Not protection against keyloggers, malicious extensions, XSS or compromised third-party scripts.** Anything running in the page can read `input.value`; a glyph can't change that.
- **Not verification.** Keep comparing on submit.
- **Not memorable**, deliberately: your glyph is different every visit.

## Try it

- Demo: https://mrlouiswright.github.io/passglyph/ (drag the bits slider to see the trade-off live)
- Threat model: https://github.com/MrLouisWright/passglyph/blob/main/SECURITY-DESIGN.md
- Code: https://github.com/MrLouisWright/passglyph

I'd love scrutiny of the threat model. If you can get more than b bits out of a glyph, or anything without the salt, please open an issue.

*Louis Wright*
