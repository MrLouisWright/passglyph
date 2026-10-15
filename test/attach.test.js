import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attach, neutralOps, opsToSVG } from '../dist/index.mjs';
import { page, type, settle, sleep, FAST, crypto } from './helpers.js';

const N = (p) => JSON.stringify(neutralOps(p.window.getComputedStyle(p.document.querySelector('canvas')).color || '#6b7280').flatMap((o) => [['dash', o.dash.join()], ['stroke', o.stroke, o.d, o.w]]));

test('adds an aria-hidden canvas after each input and a polite status region', () => {
  const p = page();
  attach(p.pw, p.pw2, FAST);
  const [a, b] = p.document.querySelectorAll('canvas');
  assert.equal(p.pw.nextElementSibling, a);
  assert.equal(p.pw2.nextElementSibling, b);
  for (const c of [a, b]) { assert.equal(c.getAttribute('aria-hidden'), 'true'); assert.equal(c.className, 'passglyph-glyph'); assert.equal(c.hasAttribute('role'), false); }
  const s = p.document.querySelector('[role=status]');
  assert.equal(s.getAttribute('aria-live'), 'polite');
  assert.equal(s.textContent, '');
});

test('matching passwords → identical glyphs + "Passwords match"; typo → different glyph + mismatch', async () => {
  const p = page(); const seen = [];
  attach(p.pw, p.pw2, { ...FAST, onChange: (m) => seen.push(m) });
  const [a, b] = p.document.querySelectorAll('canvas');
  type(p.pw, 'correct horse battery'); type(p.pw2, 'correct horse battery');
  await settle();
  assert.equal(p.ops(a), p.ops(b));
  assert.notEqual(p.ops(a), N(p));
  assert.equal(p.document.querySelector('[role=status]').textContent, 'Passwords match');
  assert.ok(b.classList.contains('passglyph-match'));
  type(p.pw2, 'correct horse batterx');
  await settle();
  assert.equal(p.document.querySelector('[role=status]').textContent, "Passwords don't match");
  assert.ok(b.classList.contains('passglyph-mismatch') && !b.classList.contains('passglyph-match'));
  assert.deepEqual(seen, [true, false]);
});

test('typos are caught: 40 one-character typos, ≥ 38 give a different glyph (2^-10 false match)', async () => {
  const p = page();
  attach(p.pw, p.pw2, FAST);
  const [a, b] = p.document.querySelectorAll('canvas');
  type(p.pw, 'Tr0ub4dor&3-extended'); await settle();
  let differ = 0;
  for (let i = 0; i < 40; i++) { type(p.pw2, 'Tr0ub4dor&3-extended'.slice(0, -1) + String.fromCharCode(97 + (i % 26)) + i); await sleep(150); if (p.ops(a) != p.ops(b)) differ++; }
  assert.ok(differ >= 38, String(differ));
});

test('NO derived data in the DOM: the serialised document is identical for different passwords', async () => {
  const run = async (pw) => {
    const p = page(); attach(p.pw, p.pw2, FAST);
    type(p.pw, pw); type(p.pw2, pw); await settle();
    // input.value is a property, not an attribute; nothing password-derived should be serialised
    return { html: p.document.documentElement.outerHTML, ops: p.ops(p.document.querySelector('canvas')) };
  };
  const x = await run('alpha-password-0001'), y = await run('bravo-password-0002');
  assert.equal(x.html, y.html);
  assert.notEqual(x.ops, y.ops); // ...while the pixels do differ
  assert.doesNotMatch(x.html, /passglyph\/v1|#E69F00|#56B4E9|#009E73|#F0E442|#0072B2|#D55E00|#CC79A7|#8C8C8C|<svg|<path|data-/i);
});

test('NO derived data in attributes or text nodes (mismatch state too)', async () => {
  const p = page(); attach(p.pw, p.pw2, FAST);
  type(p.pw, 'first-long-password'); type(p.pw2, 'other-long-password'); await settle();
  const all = [...p.document.querySelectorAll('*')];
  const attrs = all.flatMap((e) => [...e.attributes].map((a) => a.value));
  const texts = []; const w = p.document.createTreeWalker(p.document, 4); while (w.nextNode()) texts.push(w.currentNode.data);
  assert.deepEqual(texts, ["Passwords don't match"]);
  for (const v of attrs) assert.match(v, /^(|true|password|new-password|pw2?|polite|status|passglyph-glyph( passglyph-(mis)?match)?|passglyph-sr|\d+|[a-z-]+: [^;]+;.*)$/, v);
});

test('short input shows the fixed neutral glyph and announces nothing', async () => {
  const p = page(); attach(p.pw, p.pw2, FAST);
  const [a, b] = p.document.querySelectorAll('canvas');
  for (const v of ['a', 'abc', 'abcdefg']) { type(p.pw, v); type(p.pw2, v); await settle(); assert.equal(p.ops(a), N(p), v); assert.equal(p.ops(b), N(p)); }
  assert.equal(p.document.querySelector('[role=status]').textContent, '');
  type(p.pw, 'abcdefgh'); await settle();
  assert.notEqual(p.ops(a), N(p));
});

test('minLength is clamped to at least 4', async () => {
  const p = page(); attach(p.pw, p.pw2, { ...FAST, minLength: 1 });
  type(p.pw, 'abc'); await settle();
  assert.equal(p.ops(p.document.querySelector('canvas')), N(p));
});

test('no per-keystroke updates: nothing repaints until typing pauses for the debounce', async () => {
  const p = page(); attach(p.pw, p.pw2, { ...FAST, debounce: 150 });
  const a = p.document.querySelector('canvas');
  const before = p.ops(a); let paints = 0;
  const orig = p.log.set.bind(p.log); p.log.set = (k, v) => { if (k == a) paints++; return orig(k, v); };
  for (const ch of 'abcdefghijkl') { type(p.pw, p.pw.value + ch); await sleep(40); }
  assert.equal(p.ops(a), before);
  assert.equal(paints, 0);
  await sleep(300);
  assert.equal(paints, 1); // exactly one repaint for the whole burst
});

test('constant-ish timing: repaint lands at debounce + budget for short and long input alike', async () => {
  const when = async (v) => {
    const p = page(); attach(p.pw, p.pw2, { ...FAST, debounce: 100, budget: 200 });
    const a = p.document.querySelector('canvas'); let t;
    const orig = p.log.set.bind(p.log); p.log.set = (k, x) => { if (k == a) t = Date.now(); return orig(k, x); };
    const t0 = Date.now(); type(p.pw, v); await sleep(450); return t - t0;
  };
  const short = await when('ab'), long = await when('a-much-longer-password-value-here');
  for (const t of [short, long]) assert.ok(t >= 295 && t < 420, String(t));
  assert.ok(Math.abs(short - long) < 60, `${short} vs ${long}`);
});

test('no network and no storage APIs are touched', async () => {
  const p = page(); const touched = [];
  const trap = (o, k) => { try { Object.defineProperty(o, k, { configurable: true, get() { touched.push(k); return () => {}; } }); } catch {} };
  for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'caches']) { trap(p.window, k); trap(globalThis, k); }
  trap(p.window.navigator, 'sendBeacon'); trap(p.document, 'cookie');
  const off = attach(p.pw, p.pw2, FAST);
  type(p.pw, 'some-long-password'); type(p.pw2, 'some-long-password'); await settle(); off();
  for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'caches']) { delete p.window[k]; delete globalThis[k]; }
  assert.deepEqual(touched, []);
});

test('CSP: no <style> elements and no setAttribute("style"); unstyled sets no style at all', async () => {
  const p = page(); const set = p.window.Element.prototype.setAttribute; const names = [];
  p.window.Element.prototype.setAttribute = function (n, v) { names.push(n); return set.call(this, n, v); };
  attach(p.pw, p.pw2, FAST);
  assert.ok(!names.includes('style'));
  assert.equal(p.document.querySelectorAll('style').length, 0);
  const q = page(); attach(q.pw, q.pw2, { ...FAST, unstyled: true });
  assert.equal(q.document.querySelectorAll('[style]').length, 0);
});

test('fails closed without canvas: no glyph, accessible status still works', async () => {
  const p = page({ canvas: false }); attach(p.pw, p.pw2, FAST);
  type(p.pw, 'long-enough-pass'); type(p.pw2, 'long-enough-pass'); await settle();
  assert.equal(p.document.querySelector('[role=status]').textContent, 'Passwords match');
});

test('autofill: values present at attach and change events are picked up', async () => {
  const p = page(); p.pw.value = p.pw2.value = 'filled-by-manager-123';
  attach(p.pw, p.pw2, FAST); await settle();
  assert.equal(p.document.querySelector('[role=status]').textContent, 'Passwords match');
  p.pw2.value = 'changed-by-manager-456'; p.pw2.dispatchEvent(new p.window.Event('change')); await settle();
  assert.equal(p.document.querySelector('[role=status]').textContent, "Passwords don't match");
});

test('inputs are left alone (type, name, autocomplete, position)', () => {
  const p = page(); const before = p.pw.outerHTML, parent = p.pw.parentNode;
  attach(p.pw, p.pw2, FAST);
  assert.equal(p.pw.outerHTML, before); assert.equal(p.pw.parentNode, parent); assert.equal(p.pw.type, 'password');
});

test('detach removes every node, listener and pending update', async () => {
  const p = page(); const html = p.document.body.innerHTML;
  const off = attach(p.pw, p.pw2, FAST);
  type(p.pw, 'pending-update-xyz'); off();
  assert.equal(p.document.body.innerHTML, html);
  type(p.pw2, 'pending-update-xyz'); await settle();
  assert.equal(p.document.body.innerHTML, html);
});

test('custom labels, mount and mountStatus', async () => {
  const p = page(); const box = p.document.createElement('div'); p.document.body.append(box);
  attach(p.pw, p.pw2, { ...FAST, labels: { match: 'OK', mismatch: 'Nope' }, mount: (i, c) => box.append(c), mountStatus: (s) => box.append(s) });
  type(p.pw, 'same-same-same'); type(p.pw2, 'same-same-same'); await settle();
  assert.equal(box.children.length, 3);
  assert.equal(box.lastChild.textContent, 'OK');
});

test('two forms on one page get independent salts', async () => {
  const seen = new Set();
  for (let i = 0; i < 8; i++) { const p = page(); attach(p.pw, p.pw2, { ...FAST, bits: 12 }); type(p.pw, 'shared-password'); await settle(); seen.add(p.ops(p.document.querySelector('canvas'))); }
  assert.ok(seen.size >= 6, String(seen.size));
});

test('without WebCrypto: no glyph, never Math.random, status still works, onFallback called', async () => {
  const p = page(); const why = []; const rnd = Math.random; let used = 0; Math.random = () => (used++, rnd());
  attach(p.pw, p.pw2, { ...FAST, crypto: {}, onFallback: (r) => why.push(r) });
  type(p.pw, 'long-enough-pass'); type(p.pw2, 'long-enough-pass'); await settle(); Math.random = rnd;
  assert.deepEqual(why, ['webcrypto']); assert.equal(used, 0);
  assert.equal(p.document.querySelectorAll('canvas').length, 0);
  assert.equal(p.document.querySelector('[role=status]').textContent, 'Passwords match');
});

test('credit defaults off; when on mounts a fixed link; detach removes it', async () => {
  const p = page();
  attach(p.pw, p.pw2, FAST);
  assert.equal(p.document.querySelector('.passglyph-credit'), null);
  const off = attach(p.pw, p.pw2, { ...FAST, credit: true });
  const a = p.document.querySelector('a.passglyph-credit');
  assert.ok(a);
  assert.equal(a.href, 'https://louiswright.co.uk/');
  assert.equal(a.getAttribute('rel'), 'noopener');
  assert.equal(a.textContent, 'Built with passglyph');
  assert.equal(a.getAttribute('style'), null);
  // Fixed credit text must not vary with passwords (no derived data)
  type(p.pw, 'alpha-password-0001'); type(p.pw2, 'alpha-password-0001'); await settle();
  assert.equal(a.textContent, 'Built with passglyph');
  off();
  assert.equal(p.document.querySelector('.passglyph-credit'), null);
});

test('creditTarget appends the credit link into a chosen container', () => {
  const p = page();
  const box = p.document.createElement('div');
  p.document.body.append(box);
  const off = attach(p.pw, p.pw2, { ...FAST, credit: true, creditTarget: box });
  assert.equal(box.querySelector('.passglyph-credit').parentNode, box);
  off();
  assert.equal(box.querySelector('.passglyph-credit'), null);
});
