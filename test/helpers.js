import { JSDOM, VirtualConsole } from 'jsdom';
import { webcrypto } from 'node:crypto';

export const crypto = webcrypto;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** jsdom page with two password fields. `canvas: true` installs a recording 2D context + Path2D. */
export const page = ({ canvas = true, html } = {}) => {
  const { window } = new JSDOM(html || '<!doctype html><form><input id="pw" type="password" autocomplete="new-password"><input id="pw2" type="password" autocomplete="new-password"></form>', { virtualConsole: new VirtualConsole(), pretendToBeVisual: true, url: 'https://example.com/' });
  const log = new Map(), xlog = new Map(), paints = new Map(); // canvas → ops / x offsets / paint count
  if (canvas) {
    window.Path2D = class { constructor(d) { this.d = d; } };
    window.HTMLCanvasElement.prototype.getContext = function () {
      const el = this, rec = [], xs = [];
      let tx = 0;
      return {
        font: '', measureText: () => ({ width: 8 }),
        setTransform(a, b, c, d, e) { tx = e; }, setLineDash(d) { rec.push(['dash', d.join()]); },
        clearRect() { rec.length = 0; xs.length = 0; log.set(el, rec); xlog.set(el, xs); paints.set(el, (paints.get(el) || 0) + 1); },
        fill(p, rule) { rec.push(['fill', this.fillStyle, p.d, rule]); xs.push(tx); }, stroke(p) { rec.push(['stroke', this.strokeStyle, p.d, this.lineWidth]); },
        set fillStyle(v) { this._f = v; }, get fillStyle() { return this._f; }, set strokeStyle(v) { this._s = v; }, get strokeStyle() { return this._s; },
      };
    };
  }
  const d = window.document;
  return { window, document: d, pw: d.getElementById('pw'), pw2: d.getElementById('pw2'), ops: (c) => JSON.stringify(log.get(c) || null), log, xlog, paints };
};

export const type = (input, value) => { input.value = value; input.dispatchEvent(new input.ownerDocument.defaultView.Event('input', { bubbles: true })); };
export const FAST = { crypto, debounce: 100, budget: 0, iterations: 10000, mode: 'badge' };
export const INLINE = { crypto, debounce: 100 };
/** wait for debounce + derivation */
export const settle = () => sleep(220);
