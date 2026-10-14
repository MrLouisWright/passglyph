# Security Design

Mirror of [SECURITY-DESIGN.md](https://github.com/MrLouisWright/passglyph/blob/main/SECURITY-DESIGN.md) (the repository copy is authoritative). Author: Louis Wright.

Status: v2 design. Author: Louis Wright. v1's single-glyph design is kept as **badge mode** (Appendix B).

## 1. What passglyph does

**Inline mode (default, v2):** the masking dots inside a password field and its confirm field are drawn as Egyptian hieroglyphs. Same password → same glyph sequence in both fields. A typo changes the glyph at the first wrong position and (almost certainly) every glyph after it. The user spots the mistake without the password being shown.

**Badge mode (v1, `mode: 'badge'`):** one small glyph beside each field.

Prior art (Arc90's HashMask and Chroma-Hash, both 2009, and the HashMask Chrome extension, 2013) showed a fast hash of the password, unsalted or with a static site-wide salt. That's a stable fingerprint that can be brute-forced offline from a screenshot and recognised across sites. passglyph is designed so that this doesn't happen.

## 2. Assets and actors

**Assets:** the password being typed, and the user's other passwords (reuse).

| # | Adversary | Capability |
|---|---|---|
| A1 | Shoulder surfer / camera / screen recording / screen-share / screenshot | Sees the glyphs, possibly keystroke by keystroke and across sessions; not page memory |
| A2 | Cross-site / cross-session correlator | Collects glyph sequences from several sites or sessions |
| A3 | DOM observer without script execution (session replay, DOM snapshots, accessibility-tree dumps, bug-report HTML) | Sees DOM and a11y tree, not pixels or memory |
| A4 | Timing observer | Sees when glyphs change |

**Out of scope:** keyloggers, malware, extensions with page access, XSS, compromised third-party scripts. Anything that runs in the page can read `input.value`.

## 3. Why not map characters to glyphs?

The obvious design, character c → glyph f(c), is a **substitution cipher**. Even with a secret per-session f:

- repeated characters show repeated glyphs, so `balloon` reveals the pattern `ab cc dd e` (positions 3=4 and 5=6);
- the password's structure (which positions are equal) is visible to A1 in every session;
- A1 can learn f outright from a few sessions or from known text typed into the same field;
- dictionary words are recognisable from their letter pattern alone.

passglyph never does this. (The demo has a toggle that shows the pattern leak.)

## 4. Inline mode design

### 4.1 Per-instance key from a fresh salt

Each `attach()` (each `<pass-glyph>`, each hook instance) creates a 128-bit random salt with `crypto.getRandomValues`, prefixed with the label `passglyph/v1`. It's imported straight away as a **non-extractable** WebCrypto HMAC-SHA-256 key, and the raw salt bytes are zero-filled. From then on the secret exists only inside a `CryptoKey`: script can't export it, it isn't in the DOM, storage, the network or a global, and the handle passglyph returns doesn't expose it. Both fields of a pair share the key, which is the only thing that makes them comparable. Every page load, tab, form and site gets a different key.

If `crypto.getRandomValues` or `crypto.subtle` is missing, passglyph **falls back to normal dots**. It never uses `Math.random`.

### 4.2 Glyph i is a keyed hash of the whole prefix

```
g[i] = first b bits of HMAC-SHA-256(key, UTF-8(password[0..i]))     (positions = Unicode code points)
```

- **Identical characters don't give identical glyphs.** `aaaa` hashes `a`, `aa`, `aaa`, `aaaa`: four independent values (tested).
- **A mismatch shows from the first wrong position on.** The two fields' sequences agree exactly up to the first difference. After it, every later glyph differs with probability 1 − 2^-b, independently.
- No PBKDF2 here. Inline glyphs must update on every keystroke (like dots), and the key is 128 random bits, not a password, so offline brute force of the key is infeasible and slowness buys nothing. Badge mode still uses PBKDF2 (Appendix B).
- The HMAC outputs are zero-filled after truncation. The only derived state kept is the current sequence of b-bit indices, needed to redraw on scroll and resize. It's discarded on the next input and on `detach()`.

### 4.3 Low bits per glyph: 4–6, default 5

The alphabet is the first 2^b glyphs of a curated set of 64 hieroglyphs: 16, 32 (default) or 64. `bits` is clamped to 4–6, so asking for more gives 6.

**Typo detection.** A typo at position i is missed at that position with probability 2^-b, and at each of the following k positions independently with probability 2^-b, so it's missed entirely with probability 2^-b(k+1):

| b | alphabet | missed at that one position | missed at it and the next 9 positions |
|---|---|---|---|
| 4 | 16 | 6.25 % | 2^-40 ≈ 10^-12 |
| **5** | **32** | **3.1 %** | **2^-50 ≈ 10^-15** |
| 6 | 64 | 1.6 % | 2^-60 ≈ 10^-18 |

(A typo in the *last* character is the weakest case: it's caught only by that position, so 1 − 2^-b. The match announcement, which compares the values exactly, covers it.)

**What an observer learns: the honest numbers.**

- **A1/A2 without the key: 0 bits.** HMAC with an unknown 128-bit key is a PRF. Glyph sequences from different sessions are independent, and nothing can be compared across sessions or sites.
- **Under that session's key, a recording carries about b bits per position:** b·n bits for an n-character password (5 × 12 = 60 bits at the default). That sounds like a lot, and it is. If an attacker also obtained the key (i.e. ran code in that page, or dumped its memory), **prefix hashing lets them recover the password one character at a time**: for each position, try the ~95 printable characters, keep those whose HMAC matches. About 95/2^b candidates survive per position (≈ 3 at b = 5, ≈ 1.5 at b = 6, ≈ 6 at b = 4). That leaves about n·log2(95/2^b) bits: about 19 bits for 12 characters at b = 5, which is trivial to finish offline. **So inline mode's protection rests entirely on the key never leaving memory.** It doesn't: it's non-extractable, never serialised and dies with the page. And an attacker who can reach it can read `input.value` directly, so the realistic marginal risk is small. But it's very different from badge mode, where even a stolen key yields at most 12 bits behind PBKDF2. If your threat model includes memory disclosure *without* script execution (e.g. crash dumps sent to a third party), use badge mode.
- **The typo position is revealed** to anyone watching: the sequences diverge exactly at the first wrong character. That's acceptable UX (it's the feature) but it's a leak: an observer learns "the confirm field differs from position 7 on". On its own it says nothing about the characters.
- **The match/mismatch bit** is visible, as with any "passwords don't match" message.

### 4.4 No extra length or timing leak

- **Length:** one glyph per character, exactly where the dots were. The dots already reveal length, so nothing is added. (Positions are code points. A browser that draws two dots for one astral character, e.g. some emoji, would misalign, but reveals nothing extra.)
- **No per-keystroke flourish:** no animation, fade or "reveal last character". The overlay repaints in a single frame per input. Mobile browsers' "show the last typed character briefly" is suppressed too, because the native text is transparent. `prefers-reduced-motion` needs no special handling because nothing moves.
- **Timing:** each input recomputes the HMAC of *every* prefix (n HMACs, microseconds each). The work depends only on the length, which is public, never on content or on whether the fields match. The match announcement is debounced (300 ms) and only made at ≥ minLength.
- **Stability while typing:** earlier glyphs never change when you append characters (their prefixes didn't change), so watching someone type shows only "one more glyph", the same as dots.

### 4.5 Rendering: the real input stays a password input

- The `<input type="password">` is **not replaced, wrapped, cloned or retyped**. Its type, name, id and autocomplete are unchanged, so autofill, password managers, mobile secure keyboards, screen readers, form submission and `:invalid` styling all keep working.
- passglyph hides the native dots with CSSOM properties on the input (`color: transparent`, `-webkit-text-fill-color: transparent`), keeps the caret visible (`caret-color`), and sets `letter-spacing` so each native mask cell is exactly one glyph cell wide. The caret, selection and click-to-position therefore line up with the glyphs. All four properties are restored exactly on `detach()`.
- Glyphs are painted on an absolutely positioned `<canvas aria-hidden="true">` overlay (`pointer-events: none`) above the input's padding box. It follows `scrollLeft` (long passwords), `direction: rtl`, font-size and zoom changes (`ResizeObserver` + `resize`), and selection changes (the native selection highlight shows through).
- **IME composition:** native dots are shown during composition and glyphs return on `compositionend`.
- **Fallback to normal dots** if canvas, `Path2D`, `measureText` or WebCrypto is unavailable (`onFallback(reason)` is called). The input is then left completely untouched.

### 4.6 No code points or derived data in the DOM

Hieroglyphs come from a bundled **sprite**: 64 curated signs from U+13000–U+1342F, rasterised from Noto Sans Egyptian Hieroglyphs (OFL-1.1) to 32×32 bitmaps and expanded at runtime into SVG path data for `Path2D`. **No font is loaded and no hieroglyph code point is ever put in the DOM.** Text nodes or attributes containing `𓂀` would expose each position's glyph (the derived bits) to A3, and would depend on system fonts that often lack the block. The DOM snapshot is **byte-for-byte identical for any two passwords** with the same match state, and no character in U+13000–U+1342F, no path data and no `data-*` attribute appears anywhere (tested).

## 5. Common to both modes

- **Accessibility:** overlays and badges are `aria-hidden`. A visually hidden `role="status"` / `aria-live="polite"` region announces "Passwords match" or "Passwords don't match" once both fields have ≥ minLength (8) characters, after a 300 ms debounce. Screen readers otherwise keep reading the password field as a password field. Glyphs differ by shape, never only by colour (inline glyphs are monochrome in the input's text colour; badge glyphs use the Okabe–Ito palette plus shape and mark).
- **No network, no storage, no globals:** passglyph never calls `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB` or cookies (trapped in tests). The only global is the optional `customElements.define('pass-glyph')`.
- **CSP:** no `<style>` elements, no `style="..."` in markup (no `setAttribute('style')`), no `eval` or `new Function`, no fonts, and no network. Styles are set through the CSSOM, which `style-src` without `'unsafe-inline'` doesn't block, so no nonce is needed. Works under `default-src 'self'`.
- **Password managers and autofill:** listened to via `input` and `change`, plus a check at attach time for values filled earlier.

## 6. Threats → mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Substitution-cipher pattern leak (repeated characters, structure) | Prefix HMAC, not per-character mapping | None |
| Screenshot or recording used offline (A1) | Unknown non-extractable 128-bit key | None without the key; with the key ≈ full recovery in inline mode (4.3) |
| Linking sessions or sites (A2) | Fresh key per instance | None |
| DOM / a11y-tree / session-replay disclosure (A3) | Canvas-only rendering from a sprite; no code points; snapshot-identical DOM | Match bit visible |
| Length / rhythm / timing (A1, A4) | One glyph per dot, single-frame repaint, work ∝ public length | Length (already visible as dots) |
| Typo position | — (it's the feature) | Position of first mismatch visible |
| Weak RNG | `getRandomValues` only; else fall back to dots | None |
| Unsupported browser features | Fall back to native dots | Plain dots UX |

## 7. What passglyph is not

- **Not a strength meter.** Matching says nothing about strength.
- **Not protection against keyloggers, malicious extensions, XSS or compromised scripts.**
- **Not verification:** keep comparing on submit.
- **Not memorable**, deliberately: the sequence changes every page load.

## 8. Parameters

| Option | Inline default | Badge default | Allowed |
|---|---|---|---|
| `mode` | `'inline'` | `'badge'` | |
| `bits` | 5 per position | 10 total | inline 4–6, badge 4–12 (clamped) |
| `minLength` | 8 (announcement) | 8 (glyph + announcement) | ≥ 4 |
| `iterations` | — | 60 000 | ≥ 10 000 |
| `debounce` | 300 ms (announcement) | 300 ms | ≥ 100 |
| `size` | 1.1 em cell | 20 px | |

## 9. Tests that enforce this document

Inline: identical repeated characters give different glyphs; sequences agree up to the first difference and diverge after; same salt gives the same sequence in both fields; a fresh salt gives a different sequence; bits clamped to 4–6; the key is non-extractable and the salt is wiped; no code points, path data or derived data in the DOM (snapshot equality across passwords); `type=password`, name and autocomplete preserved; one repaint per input; paste; scroll and RTL; IME; letter-spacing alignment; fallback without canvas or WebCrypto; detach restores the input exactly; no network, storage or style injection.
Badge (unchanged from v1): salt uniqueness, entropy cap, DOM independence, neutral glyph for short input, debounce, fixed-deadline timing, no network or storage, CSP, a11y, detach.

---

## Appendix B: badge mode (v1)

Each field gets one glyph: `PBKDF2-HMAC-SHA-256(password, salt, 60 000 iterations)` → 4–12 bits (default 10, hard cap 12), drawn from an alphabet of shape × Okabe–Ito colour × mark × pips × frame. A fixed neutral glyph is shown below minLength, and the repaint is debounced to a fixed deadline. It leaks far less than inline mode (≤ 12 bits in total even with the salt) but doesn't show *where* a typo is.

### B.1 Keyed, slow-ish derivation

```
bits = PBKDF2-HMAC-SHA-256(password, salt = "passglyph/v1" ‖ random128, iterations = 60 000, 32 bits)
```

- It uses WebCrypto (`crypto.subtle`), never hand-rolled crypto.
- The default is 60,000 iterations, which takes roughly 15–60 ms on current laptops and phones. That's fast enough for a field the user has stopped typing in. The minimum is 10,000, enforced; lower values are raised to it. Even an attacker who somehow has the salt (an A1 attacker who also dumped memory) pays 60,000 HMACs per guess, not one SHA-256.
- Input is **debounced** (300 ms default): there's no derivation, and no glyph change, while the user is typing.
- The `PBKDF2` key is imported as **non-extractable**, used once and dropped. Only 32 bits are derived, and the `ArrayBuffer` is zero-filled right after the glyph index is taken. JS strings (the password itself) can't be wiped; that's a platform limitation shared with the input element.

### B.2 Deliberately low entropy on screen

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
- **Prefixes.** Debouncing means a user who pauses mid-password shows a glyph of the prefix. With the salt this would leak b bits about a shorter string, which is why B.3 exists and why the default minimum length is 8.

### B.3 No glyph for short inputs, no per-keystroke animation

- Below `minLength` (8 by default, never below 4) a fixed **neutral** glyph is shown. It's identical for every short value, including empty, so short passwords never get a glyph worth recording.
- There's no per-keystroke animation, no blanking and no colour flash while typing. The glyph changes only after the debounce, and only at most once per pause. So the display doesn't reveal how many characters were typed, or their rhythm.
- The neutral glyph reveals only "at least minLength characters", which is already visible from the masked dots in any password field.

### B.4 Constant-ish timing

Each settled input runs **one derivation regardless of length** (short values still derive, the result is discarded). The repaint is then scheduled at a fixed deadline: `last input + debounce + budget` (budget is 250 ms by default, or the actual derivation time if that's longer). PBKDF2 cost doesn't depend on password length below the HMAC block size (64 bytes). So when the glyph changes reveals nothing about the length or content of the password, or about whether it matched (A4).

