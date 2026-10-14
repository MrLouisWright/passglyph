import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attach, createSalt, instanceKey, glyphSequence, clampGlyphBits } from '../dist/index.mjs';
import { hieroglyphPath, CODEPOINTS, HIEROGLYPH_COUNT } from '../dist/hieroglyphs.mjs';
import { page, type, settle, sleep, INLINE, crypto } from './helpers.js';

const PATHS = Array.from({ length: 64 }, (_, i) => hieroglyphPath(i));
/** glyph sequence actually painted on an overlay canvas */
const painted = (p, c) => JSON.parse(p.ops(c) || '[]').filter((o) => o[0] == 'fill').map((o) => PATHS.indexOf(o[2]));
const tick = () => sleep(30);
const HIERO = /[\u{13000}-\u{1342F}]/u;

// ---- derivation ----
test('glyphSequence: identical repeated characters do not give identical glyphs', async () => {
  const k = await instanceKey(createSalt(crypto), crypto);
  const s = await glyphSequence(k, 'aaaaaaaaaaaaaaaa', 5, crypto);
  assert.equal(s.length, 16);
  assert.ok(new Set(s).size >= 8, JSON.stringify(s)); // a substitution cipher would give 1
});

test('glyphSequence: prefix-keyed, so sequences agree up to the first difference and diverge after', async () => {
  const k = await instanceKey(createSalt(crypto), crypto);
  const a = await glyphSequence(k, 'correct horse battery', 6, crypto), b = await glyphSequence(k, 'correct hXrse battery', 6, crypto);
  assert.deepEqual(a.slice(0, 9), b.slice(0, 9));
  const after = a.slice(9).filter((v, i) => v !== b[9 + i]).length;
  assert.ok(after >= 9, String(after)); // 12 later positions, ~1/64 chance each to coincide
});

test('glyphSequence: same salt → same sequence; fresh salt → different sequence', async () => {
  const s = createSalt(crypto);
  const k1 = await instanceKey(s.slice(), crypto), k2 = await instanceKey(s.slice(), crypto), k3 = await instanceKey(createSalt(crypto), crypto);
  const v = 'same input value';
  assert.deepEqual(await glyphSequence(k1, v, 5, crypto), await glyphSequence(k2, v, 5, crypto));
  assert.notDeepEqual(await glyphSequence(k1, v, 5, crypto), await glyphSequence(k3, v, 5, crypto));
});

test('glyphSequence: bits per position capped at 6 (64 glyphs), floor 4, default 5', async () => {
  assert.equal(clampGlyphBits(undefined), 5); assert.equal(clampGlyphBits(12), 6); assert.equal(clampGlyphBits(1), 4);
  const k = await instanceKey(createSalt(crypto), crypto);
  for (const [b, cap] of [[4, 16], [5, 32], [6, 64], [32, 64]]) {
    const s = await glyphSequence(k, 'x'.repeat(200) + 'abcdefghij'.repeat(10), b, crypto);
    assert.ok(Math.max(...s) < cap, `${b}`);
  }
});

test('glyphSequence counts code points (astral characters are one position)', async () => {
  const k = await instanceKey(createSalt(crypto), crypto);
  assert.equal((await glyphSequence(k, 'a😀b𓂀', 5, crypto)).length, 4);
});

test('instanceKey: non-extractable HMAC key and the salt bytes are wiped', async () => {
  const s = createSalt(crypto), k = await instanceKey(s, crypto);
  assert.equal(k.extractable, false); assert.equal(k.algorithm.name, 'HMAC');
  assert.ok(s.every((b) => b === 0));
  await assert.rejects(crypto.subtle.exportKey('raw', k));
});

test('sprite: 64 curated hieroglyphs, all in U+13000–U+1342F, all distinct', () => {
  assert.equal(HIEROGLYPH_COUNT, 64); assert.equal(new Set(CODEPOINTS).size, 64);
  for (const c of CODEPOINTS) assert.ok(c >= 0x13000 && c <= 0x1342f, c.toString(16));
  assert.equal(new Set(PATHS).size, 64);
  for (const d of PATHS) assert.match(d, /^(M\d+ \d+h\d+v1h-\d+z)+$/);
});

// ---- inline rendering ----
test('inline: aria-hidden overlay per field, input stays type=password with name/autocomplete', async () => {
  const p = page(); p.pw.name = 'new-password';
  attach(p.pw, p.pw2, INLINE);
  const cs = p.document.querySelectorAll('canvas.passglyph-overlay');
  assert.equal(cs.length, 2);
  for (const c of cs) { assert.equal(c.getAttribute('aria-hidden'), 'true'); assert.equal(c.style.pointerEvents, 'none'); }
  assert.equal(p.pw.type, 'password'); assert.equal(p.pw.getAttribute('type'), 'password');
  assert.equal(p.pw.name, 'new-password'); assert.equal(p.pw.getAttribute('autocomplete'), 'new-password');
  assert.equal(p.pw.style.color, 'transparent'); // native dots hidden, caret kept
  assert.ok(p.pw.style.caretColor);
});

test('inline: one glyph per character, same input → same sequence in both fields', async () => {
  const p = page(); attach(p.pw, p.pw2, INLINE);
  const [a, b] = p.document.querySelectorAll('canvas');
  type(p.pw, 'hunter2hunter2'); type(p.pw2, 'hunter2hunter2'); await tick();
  const A = painted(p, a), B = painted(p, b);
  assert.equal(A.length, 14); assert.ok(A.every((i) => i >= 0 && i < 32));
  assert.deepEqual(A, B);
});

test('inline: repeated characters do not repeat glyphs on screen', async () => {
  const p = page(); attach(p.pw, p.pw2, INLINE);
  type(p.pw, 'zzzzzzzzzzzz'); await tick();
  assert.ok(new Set(painted(p, p.document.querySelector('canvas'))).size >= 6);
});

test('inline: a typo shows from the first wrong position on', async () => {
  const p = page(); attach(p.pw, p.pw2, { ...INLINE, bits: 6 });
  const [a, b] = p.document.querySelectorAll('canvas');
  type(p.pw, 'Tr0ub4dor&3-extra'); type(p.pw2, 'Tr0ub4dXr&3-extra'); await tick();
  const A = painted(p, a), B = painted(p, b);
  assert.deepEqual(A.slice(0, 7), B.slice(0, 7));
  assert.ok(A.slice(7).filter((v, i) => v !== B[7 + i]).length >= 8);
});

test('inline: fresh salt per attach → different sequence for the same password', async () => {
  const seen = new Set();
  for (let i = 0; i < 6; i++) { const p = page(); attach(p.pw, p.pw2, INLINE); type(p.pw, 'shared-password'); await tick(); seen.add(JSON.stringify(painted(p, p.document.querySelector('canvas')))); }
  assert.equal(seen.size, 6);
});

test('inline: unsafeSalt reproduces a sequence (testing only) and is copied, not consumed', async () => {
  const salt = createSalt(crypto), run = async () => { const p = page(); attach(p.pw, p.pw2, { ...INLINE, unsafeSalt: salt }); type(p.pw, 'reproducible'); await tick(); return painted(p, p.document.querySelector('canvas')); };
  assert.deepEqual(await run(), await run());
  assert.ok(salt.some((b) => b !== 0));
});

test('inline: NO code points or derived data in the DOM — snapshot identical across passwords', async () => {
  const run = async (pw, pw2) => { const p = page(); attach(p.pw, p.pw2, INLINE); type(p.pw, pw); type(p.pw2, pw2); await settle(); return { p, html: p.document.documentElement.outerHTML }; };
  const x = await run('alpha-password-0001', 'alpha-password-0001'), y = await run('bravo-password-0002', 'bravo-password-0002');
  assert.equal(x.html, y.html);
  assert.notDeepEqual(painted(x.p, x.p.document.querySelector('canvas')), painted(y.p, y.p.document.querySelector('canvas')));
  assert.doesNotMatch(x.html, HIERO);
  const texts = []; const w = x.p.document.createTreeWalker(x.p.document, 4); while (w.nextNode()) texts.push(w.currentNode.data);
  assert.deepEqual(texts, ['Passwords match']);
  for (const e of x.p.document.querySelectorAll('*')) for (const a of e.attributes) { assert.doesNotMatch(a.value, HIERO); assert.doesNotMatch(a.name, /^data-/); }
  assert.doesNotMatch(x.html, /<svg|<path|M\d+ \d+h/);
});

test('inline: one repaint per input event, no per-key animation frames', async () => {
  const p = page(); attach(p.pw, p.pw2, INLINE);
  const a = p.document.querySelector('canvas'); await tick();
  const before = p.paints.get(a) || 0;
  type(p.pw, 'abcdefgh'); await sleep(120);
  assert.equal((p.paints.get(a) || 0) - before, 1);
});

test('inline: paste of a whole password draws every position at once', async () => {
  const p = page(); attach(p.pw, p.pw2, INLINE);
  type(p.pw, 'pasted-in-one-go-1234567890'); await tick();
  assert.equal(painted(p, p.document.querySelector('canvas')).length, 27);
});

test('inline: glyphs scroll with the text and lay out right-to-left for dir=rtl', async () => {
  const p = page(); attach(p.pw, p.pw2, INLINE);
  const a = p.document.querySelector('canvas');
  type(p.pw, 'abcdef'); await tick();
  const x0 = p.xlog.get(a).slice();
  Object.defineProperty(p.pw, 'scrollLeft', { configurable: true, value: 10 }); p.pw.dispatchEvent(new p.window.Event('scroll')); await tick();
  assert.ok(p.xlog.get(a)[0] < x0[0]);
  const q = page(); q.pw.dir = 'rtl'; q.pw.style.direction = 'rtl'; attach(q.pw, q.pw2, INLINE);
  type(q.pw, 'abcdef'); await tick();
  const xs = q.xlog.get(q.document.querySelector('canvas'));
  assert.ok(xs[0] > xs[5], JSON.stringify(xs));
});

test('inline: IME composition shows the native dots, then glyphs return', async () => {
  const p = page(); attach(p.pw, p.pw2, INLINE);
  const a = p.document.querySelector('canvas');
  type(p.pw, 'abcdefgh'); await tick();
  p.pw.dispatchEvent(new p.window.Event('compositionstart'));
  assert.equal(p.pw.style.color, ''); assert.equal(painted(p, a).length, 0);
  p.pw.dispatchEvent(new p.window.Event('compositionend')); await tick();
  assert.equal(p.pw.style.color, 'transparent'); assert.equal(painted(p, a).length, 8);
});

test('inline: letter-spacing widens the native mask cell so the caret lines up with glyph cells', () => {
  const p = page(); p.pw.style.fontSize = '20px'; attach(p.pw, p.pw2, { ...INLINE, size: 1.2 });
  assert.equal(p.pw.style.letterSpacing, (20 * 1.2 - 8).toFixed(2) + 'px'); // measureText('•') = 8 in the mock
});

test('inline: falls back to normal dots without canvas; input untouched; status still works', async () => {
  const p = page({ canvas: false }); const before = p.pw.outerHTML, why = [];
  attach(p.pw, p.pw2, { ...INLINE, onFallback: (r) => why.push(r) });
  assert.equal(p.pw.outerHTML, before); assert.equal(p.document.querySelectorAll('canvas').length, 0);
  assert.deepEqual(why, ['canvas', 'canvas']);
  type(p.pw, 'long-enough-pass'); type(p.pw2, 'long-enough-pass'); await settle();
  assert.equal(p.document.querySelector('[role=status]').textContent, 'Passwords match');
});

test('inline: falls back to dots when WebCrypto is unavailable', () => {
  const p = page(); const why = [];
  attach(p.pw, p.pw2, { ...INLINE, crypto: {}, onFallback: (r) => why.push(r) });
  assert.deepEqual(why, ['webcrypto']); assert.equal(p.pw.style.color, ''); assert.equal(p.document.querySelectorAll('canvas').length, 0);
});

test('inline: detach restores the inputs exactly and removes overlays, listeners and status', async () => {
  const p = page(); p.pw.style.color = 'red'; const html = p.document.body.innerHTML;
  const off = attach(p.pw, p.pw2, INLINE); type(p.pw, 'abcdefgh'); off();
  assert.equal(p.document.body.innerHTML, html);
  type(p.pw, 'abcdefghi'); await settle();
  assert.equal(p.document.body.innerHTML, html);
});

test('inline: no network/storage, no <style>, no setAttribute("style")', async () => {
  const p = page(); const touched = [], names = [];
  const trap = (o, k) => { try { Object.defineProperty(o, k, { configurable: true, get() { touched.push(k); return () => {}; } }); } catch {} };
  const ks = ['fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB'];
  for (const k of ks) trap(p.window, k);
  const set = p.window.Element.prototype.setAttribute; p.window.Element.prototype.setAttribute = function (n, v) { names.push(n); return set.call(this, n, v); };
  attach(p.pw, p.pw2, INLINE); type(p.pw, 'abcdefgh'); type(p.pw2, 'abcdefgh'); await settle();
  for (const k of ks) delete p.window[k];
  assert.deepEqual(touched, []); assert.ok(!names.includes('style')); assert.equal(p.document.querySelectorAll('style').length, 0);
});

test('inline is the default mode; badge mode still available', () => {
  const p = page(); attach(p.pw, p.pw2, { crypto });
  assert.equal(p.document.querySelectorAll('canvas.passglyph-overlay').length, 2);
  const q = page(); attach(q.pw, q.pw2, { crypto, mode: 'badge' });
  assert.equal(q.document.querySelectorAll('canvas.passglyph-glyph').length, 2);
});
