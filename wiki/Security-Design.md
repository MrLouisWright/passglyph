# Security Design

Mirror of [SECURITY-DESIGN.md](https://github.com/MrLouisWright/passglyph/blob/main/SECURITY-DESIGN.md) (the repository copy is authoritative). Author: Louis Wright.

## 1. What passglyph does

passglyph draws a small glyph next to a password field and next to its confirm field. If the two values are identical, the glyphs are identical. If they differ, the glyphs almost always differ. A user can spot a typo in "confirm password" without revealing either password on screen.

Arc90's HashMask (2009), Chroma-Hash (2009, a jQuery plugin) and the HashMask Chrome extension (2013) did this with a fast hash of the password (MD5 in Chroma-Hash), at most with a static, site-wide salt, shown as colours. That design leaks a stable fingerprint of the password to anyone who can see the screen: the same password gives the same colours on every site and in every session, and an attacker with a screenshot could test candidate passwords offline at full speed. passglyph is designed so that this doesn't happen.

## 2. Assets and actors

**Assets:** the password being typed, and the user's other passwords (reuse).

**In-scope adversaries**

| # | Adversary | Capability |
|---|---|---|
| A1 | Shoulder surfer / camera / screen recording / screenshot or screen-share | Sees the glyphs (possibly many times, across sessions) but not page memory |
| A2 | Cross-site / cross-session correlator | Collects glyphs from several sites or sessions and tries to link them to one password |
| A3 | Screen-reader / DOM observer without script execution (e.g. accessibility tree dumps, DOM snapshots in bug reports, session-replay tools that serialise DOM) | Sees the DOM and accessibility tree, not pixels or JS memory |
| A4 | Timing observer | Measures when glyphs update |

**Out of scope (stated limitations, see section 8):** keyloggers, malware, browser extensions with page access, and any malicious or compromised script on the same page. All of these can read `input.value` directly, so no glyph design can help.

## 3. Design decisions

### 3.1 Fresh random salt per form instance

Every `attach()` call (and every `<pass-glyph>` element) creates a 128-bit salt with `crypto.getRandomValues`. The password field and confirm field of that pair share it, which is what makes them comparable. Two pairs on the same page, two page loads, two tabs and two sites all get different salts.

The salt lives only in a closure. It's never written to the DOM, storage, the network, a global, or a property of the returned handle.

**Consequence for A1/A2:** the glyph is a function of (password, unknown 128-bit salt). Without the salt, a glyph carries no usable information about the password and can't be compared with a glyph from another session or site. The same password shows a different glyph on every page load.

If `crypto.getRandomValues` is unavailable, passglyph refuses to draw. It never falls back to `Math.random`.

### 3.2 Keyed, slow-ish derivation

```
bits = PBKDF2-HMAC-SHA-256(password, salt = "passglyph/v1" ‖ random128, iterations = 60 000, 32 bits)
```

- It uses WebCrypto (`crypto.subtle`), never hand-rolled crypto.
- The default is 60,000 iterations, which takes roughly 15–60 ms on current laptops and phones. That's fast enough for a field the user has stopped typing in. The minimum is 10,000, enforced; lower values are raised to it. Even an attacker who somehow has the salt (an A1 attacker who also dumped memory) pays 60,000 HMACs per guess, not one SHA-256.
- Input is **debounced** (300 ms default): there's no derivation, and no glyph change, while the user is typing.
- The `PBKDF2` key is imported as **non-extractable**, used once and dropped. Only 32 bits are derived, and the `ArrayBuffer` is zero-filled right after the glyph index is taken. JS strings (the password itself) can't be wiped; that's a platform limitation shared with the input element.

### 3.3 Deliberately low entropy on screen

The glyph shows **b bits**: 10 by default, configurable from 4 to 12. The cap is **hard**: values above 12 are clamped to 12. b is a trade-off between two numbers:

| b | Glyphs | Typo goes unnoticed (false match) = 2^-b | Guess-space reduction **if** the salt were known | Example: 40-bit password |
|---|---|---|---|---|
| 4 | 16 | 6.25 % | ÷16 | 36 bits left |
| 8 | 256 | 0.39 % | ÷256 | 32 bits left |
| **10** (default) | 1 024 | **0.098 %** | ÷1 024 | 30 bits left |
| 12 (cap) | 4 096 | 0.024 % | ÷4 096 | 28 bits left |

How to read this:

- **Without the salt (A1, A2, A3), the reduction is zero.** The 2^b reduction only applies to an attacker who also has page memory, and that attacker can read the password anyway.
- **Even in that worst case, b bits are at most b bits.** A screenshot never narrows the password by more than a factor of 2^b, and every remaining guess still costs a PBKDF2 evaluation. A strong password (60+ bits) stays strong. A weak password was weak before passglyph.
- **12 bits is the cap** because beyond it the typo-detection benefit is negligible (0.024 % → 0.006 %), while the worst-case leak keeps growing. Typo detection needs "probably different", not "certainly different".
- **Repeated observations.** n screenshots of *independent* sessions use n independent salts, so without the salts they're worthless. With the salts they could leak up to n·b bits. That's another reason the salt never leaves memory.
- **Prefixes.** Debouncing means a user who pauses mid-password shows a glyph of the prefix. With the salt this would leak b bits about a shorter string, which is why section 3.4 exists and why the default minimum length is 8.

### 3.4 No glyph for short inputs, no per-keystroke animation

- Below `minLength` (8 by default, never below 4) a fixed **neutral** glyph is shown. It's identical for every short value, including empty, so short passwords never get a glyph worth recording.
- There's no per-keystroke animation, no blanking and no colour flash while typing. The glyph changes only after the debounce, and only at most once per pause. So the display doesn't reveal how many characters were typed, or their rhythm.
- The neutral glyph reveals only "at least minLength characters", which is already visible from the masked dots in any password field.

### 3.5 Constant-ish timing

Each settled input runs **one derivation regardless of length** (short values still derive, the result is discarded). The repaint is then scheduled at a fixed deadline: `last input + debounce + budget` (budget is 250 ms by default, or the actual derivation time if that's longer). PBKDF2 cost doesn't depend on password length below the HMAC block size (64 bytes). So when the glyph changes reveals nothing about the length or content of the password, or about whether it matched (A4).

### 3.6 Nothing derived in the DOM, accessible match state instead

- Glyphs are drawn on a `<canvas>` with `aria-hidden="true"` and no `role`, title, label or data attributes. The DOM and accessibility tree contain **no** derived bits: no hex string, no colour value, no shape name, no path data, no class that varies with the password. **The DOM is byte-for-byte identical for any two passwords** with the same match state (tested).
- Without canvas (very old browsers, some test environments) passglyph **fails closed**: it draws nothing and keeps only the accessible match status.
- The only password-dependent thing in the DOM is the **match state** of the pair: a visually hidden `role="status"` / `aria-live="polite"` element saying "Passwords match" or "Passwords don't match". It's announced only when both values have reached `minLength`, and only after the debounce. A class (`passglyph-match` / `passglyph-mismatch`) is set on the confirm glyph for styling. This 1 bit is exactly what any "passwords don't match" message already reveals.
- Glyphs differ in **shape and inner mark as well as colour** (Okabe–Ito colour-blind-safe palette), so colour is never the only cue. The text announcement covers screen-reader users, who can't use the glyph.

### 3.7 No network, no storage, no globals

passglyph never calls `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB` or cookies (tested by trapping them). It sets no globals except the optional `customElements.define('pass-glyph')`.

### 3.8 CSP compatibility

- passglyph injects no `<style>` elements and no `style="..."` markup, and calls no `eval` or `new Function`. The few layout properties (canvas size, visually-hidden live region) are set through the CSSOM (`el.style.width = ...`), which `style-src` without `'unsafe-inline'` doesn't block. It works under `default-src 'self'; style-src 'self'; script-src 'self'`.
- If you'd rather style the elements yourself, pass `unstyled: true` and use the `passglyph-glyph` and `passglyph-sr` classes from your own stylesheet. Because passglyph never injects a `<style>` element (the web component doesn't use shadow-DOM styles either), no nonce is needed, so none is offered.

### 3.9 Password managers and autofill

passglyph doesn't wrap, move, clone or re-type the input, and doesn't change `type`, `name`, `id` or `autocomplete`. The canvas is inserted as a sibling after the input. Autofill fires `input`/`change` events, which passglyph listens for (plus a single check at attach time for values filled before attach). Generated passwords from password managers produce matching glyphs as expected.

## 4. Threats → mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Screenshot of the glyph used to test guesses offline (A1) | Unknown 128-bit salt, PBKDF2, b ≤ 12 | None without page memory |
| Same password recognised across sites or sessions (A2) | Fresh salt per instance | None |
| DOM snapshot / session replay / a11y tree reveals derived bits (A3) | Canvas only, aria-hidden, DOM independent of password | Match bit is visible (by design) |
| Typing rhythm / length via glyph changes (A1, A4) | Debounce, fixed deadline repaint, neutral glyph below minLength | "≥ minLength" revealed (already visible as dots) |
| Prefix glyphs during pauses | minLength 8, salt never exposed | b bits per prefix *if* salt known |
| Weak RNG | `crypto.getRandomValues` only; refuse otherwise | None |
| Brute force with salt (memory-dump attacker) | PBKDF2 60k, ≤ 12 bits | Same attacker can read input.value anyway |
| Accidental exfiltration | No network/storage APIs used (tested) | None |

## 5. What passglyph is not

- **Not a strength meter.** A matching glyph says nothing about strength. Pair it with zxcvbn-ts or your own policy.
- **Not protection against keyloggers, malicious extensions, XSS or compromised third-party scripts.** Anything running on the page can read the password directly.
- **Not a verification mechanism.** Compare passwords on submit as usual. The glyph is a UX hint with a 2^-b false-match rate.
- **Not a way to remember passwords.** The glyph changes every page load, by design. If users expect "my usual glyph", tell them that's intentional (see the FAQ).

## 6. Parameters

| Option | Default | Allowed |
|---|---|---|
| `bits` | 10 | 4–12 (clamped) |
| `minLength` | 8 | ≥ 4 (clamped) |
| `iterations` | 60 000 | ≥ 10 000 (clamped) |
| `debounce` | 300 ms | ≥ 100 ms |
| `budget` | 250 ms | ≥ 0 |

## 7. Tests that enforce this document

- Salt uniqueness: 1,000 instances give 1,000 distinct salts, salts come from `getRandomValues`, and a missing RNG throws.
- Different salts give a different glyph for the same password (cross-session unlinkability, statistically).
- Entropy cap: the glyph index is always `< 2^min(bits, 12)` and the number of distinct glyphs never exceeds 4,096.
- Clamping of `bits`, `minLength` and `iterations`.
- No derived data in the DOM: `outerHTML` of the whole document and every attribute value are identical for two different passwords with the same match state, and no salt or derived hex appears anywhere.
- Glyph canvases are `aria-hidden`, and the live region announces match / mismatch only at ≥ minLength.
- Short inputs give the neutral glyph. There's no repaint before the debounce, and a repaint lands at the fixed deadline.
- No network or storage API is touched (trapped).
- No `<style>` injected and no `setAttribute('style')`.
- Detach removes every node and listener.

## 8. Limitations, restated

The browser, extensions and every script on the page are trusted. passglyph narrows what *pixels and DOM* reveal; it does nothing against code that can read `input.value`.
