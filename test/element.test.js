import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, type, settle, sleep, FAST } from './helpers.js';
import { defineElement } from '../dist/element.mjs';

test('<pass-glyph> wraps two password inputs', async () => {
  const p = page({ html: '<pass-glyph bits="8" min-length="6"><input type="password"><input type="password"></pass-glyph>' });
  const El = defineElement('pass-glyph', p.window.customElements, p.window.HTMLElement);
  assert.ok(El); assert.equal(defineElement('pass-glyph', p.window.customElements, p.window.HTMLElement), El);
  const el = p.document.querySelector('pass-glyph'); el.options = FAST;
  p.window.customElements.upgrade(el); el.connectedCallback?.(); await sleep(5);
  const [a, b] = el.querySelectorAll('input');
  assert.equal(el.querySelectorAll('canvas').length, 2);
  const events = []; el.addEventListener('passglyph-change', (e) => events.push(e.detail.match));
  type(a, 'abcdef'); type(b, 'abcdef'); await settle();
  assert.equal(el.querySelector('[role=status]').textContent, 'Passwords match'); // min-length=6 honoured
  assert.deepEqual(events, [true]);
  el.remove(); await sleep(5);
  assert.equal(el.querySelectorAll('canvas').length, 0);
});

test('<pass-glyph for confirm> by id', async () => {
  const p = page({ html: '<input id="a" type="password"><input id="b" type="password"><pass-glyph for="a" confirm="b"></pass-glyph>' });
  defineElement('pass-glyph-x', p.window.customElements, p.window.HTMLElement);
  const el = p.document.createElement('pass-glyph-x'); el.setAttribute('for', 'a'); el.setAttribute('confirm', 'b'); el.options = FAST;
  p.document.body.append(el); await sleep(5);
  assert.equal(p.document.querySelectorAll('canvas').length, 2);
});

test('<pass-glyph> defaults to inline hieroglyph mode', async () => {
  const { INLINE } = await import('./helpers.js');
  const p = page({ html: '<pass-glyph><input type="password"><input type="password"></pass-glyph>' });
  defineElement('pass-glyph-i', p.window.customElements, p.window.HTMLElement);
  const el = p.document.createElement('pass-glyph-i'); el.options = INLINE;
  el.innerHTML = '<input type="password"><input type="password">'; p.document.body.append(el); await sleep(5);
  assert.equal(el.querySelectorAll('canvas.passglyph-overlay').length, 2);
  assert.equal(el.querySelector('input').type, 'password');
});
