---
title: "passglyph 2: hieroglyphs instead of password dots, and why they're not a cipher"
author: Louis Wright
status: draft
---

# passglyph 2: hieroglyphs instead of password dots, and why they're not a cipher

Every sign-up form asks you to type your new password twice and then hides both copies behind identical dots. passglyph v1 put a small glyph beside each field: same password, same glyph. v2 goes further and **replaces the dots themselves with Egyptian hieroglyphs**. 𓀀 isn't in the DOM; it's painted on canvas. When both rows match, the passwords match. When they don't, you can see *where* they start to differ.

```js
import { attach } from 'passglyph';
const detach = attach(passwordInput, confirmInput);   // mode: 'inline' is the default
```

Done naively this would be a disaster. Here's why, and what passglyph does instead.

## The trap: a glyph per character is a substitution cipher

The obvious implementation maps each character to a glyph: `a` → 𓃀, `b` → 𓆑 … Even with a secret, random table per page load, that's a substitution cipher on screen. `balloon` shows two identical pairs at positions 3–4 and 5–6. A screenshot reveals the password's *structure*, dictionary words become recognisable from their letter patterns, and a few recordings (or one known word typed into the field) recover the table. The demo has a toggle that shows exactly this.

## Glyph *i* is a keyed hash of the whole prefix

passglyph computes

```
glyph[i] = first b bits of HMAC-SHA-256(key, password[0..i])
```

`aaaa` hashes `a`, `aa`, `aaa`, `aaaa`: four unrelated glyphs. Two fields with the same text get the same row. A typo at position 6 leaves glyphs 1–5 unchanged and scrambles 6 onwards.

The key comes from 128 random bits generated per form instance. It's imported as a **non-extractable** WebCrypto key and the raw bytes are wiped, so the secret lives only inside a `CryptoKey` that no script can export. A new page load gives a new key and a new alphabet order. Nothing is ever stored or sent.

## Few bits per glyph: 5 by default

Each glyph shows 5 bits (32 signs; configurable 4–6). The numbers:

- **Typo detection:** a typo is missed at its own position 3 % of the time, and at it *and* the next nine positions 10⁻¹⁵ of the time. The live region's exact comparison covers the last-character case.
- **Leak without the key: zero.** Screenshots, recordings and shoulder surfers see a PRF output under a key that dies with the tab, and sessions can't be correlated.
- **Leak with the key: almost everything,** and I'd rather say so. Prefix hashing means an attacker holding the key can recover the password character by character, with about 3 of 95 candidates surviving per position. That's why the key is non-extractable, per instance and memory-only. And anyone who can reach it is running code in the page and could read `input.value` anyway. If memory disclosure without code execution is in your threat model, `mode: 'badge'` keeps v1's PBKDF2 single glyph (≤ 12 bits total).
- **The typo position is visible.** That's the feature, but it's also information: an onlooker learns "they differ from character 6".

## The input is still a password input

passglyph doesn't swap your field for a fake one. The `<input type="password">` keeps its type, name, autocomplete, autofill, password manager and secure keyboard. passglyph makes the native text transparent, keeps the caret, and widens the native mask characters with `letter-spacing` so each one is exactly one glyph cell wide. Then it paints the glyphs on an `aria-hidden` canvas laid over the field. Caret, click-to-position and selection line up. The canvas follows horizontal scrolling, `dir="rtl"`, zoom and font-size changes. During IME composition you get native dots back. If canvas, Path2D or WebCrypto is missing, you just get dots.

## Nothing in the DOM, no extra leaks

Hieroglyphs come from a 64-sign sprite (rasterised from Noto Sans Egyptian Hieroglyphs, OFL-1.1, 3.8 KB gz as a separate file). They're drawn via `Path2D`, and there's no font, no code point and no data attribute. The test suite serialises the document for two different passwords and asserts it's byte-for-byte identical, with no U+13000–U+1342F character anywhere. One glyph per dot means no new length leak. One repaint per input, no animation, and work proportional to the (public) length means no timing leak. Screen readers hear the field as a normal password field, plus a polite "Passwords match".

Core is 3.2 KB min+gzip, with zero dependencies, CSP-safe (no `<style>`, no eval, no network, no storage). It comes as vanilla, `<pass-glyph mode="inline">`, React and Vue.

## What it isn't

- Not a strength meter, and not verification: keep comparing on submit.
- Not protection against keyloggers, malicious extensions or XSS.
- Not memorable, deliberately: your hieroglyphs are different every visit.

## Try it

- Demo: https://mrlouiswright.github.io/passglyph/ (type in both fields, then flip the "unsafe per-character mapping" toggle)
- Threat model: https://github.com/MrLouisWright/passglyph/blob/main/SECURITY-DESIGN.md
- Code: https://github.com/MrLouisWright/passglyph
