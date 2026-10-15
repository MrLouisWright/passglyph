import { clampBits, glyphOps, neutralOps, paint } from './glyph.js';
import { createSalt, deriveIndex, instanceKey, glyphSequence, clampGlyphBits, DEFAULT_ITERATIONS } from './derive.js';
import { hieroglyphPath } from './hieroglyphs.js';

export * from './glyph.js';
export * from './derive.js';
export { hieroglyphPath, HIEROGLYPH_COUNT } from './hieroglyphs.js';

export interface PassGlyphOptions {
  /** `inline` (default): hieroglyphs replace the masking dots. `badge`: one glyph next to each field (v1). */
  mode?: 'inline' | 'badge';
  /** Bits shown. inline: per position, 4-6 (16-64 glyphs), default 5. badge: per glyph, 4-12, default 10. */
  bits?: number;
  /** Below this length nothing is announced (and badge mode shows a neutral glyph). Default 8, minimum 4. */
  minLength?: number;
  /** badge mode: PBKDF2 iterations (minimum 10 000). Default 60 000. */
  iterations?: number;
  /** Quiet time before the match announcement (and badge repaint), ms, minimum 100. Default 300. */
  debounce?: number;
  /** badge mode: fixed repaint budget after the debounce, ms. Default 250. */
  budget?: number;
  /** badge mode: glyph size in CSS px. Default 20. inline: glyph cell width in em. Default 1.1. */
  size?: number;
  /** badge mode: set no inline layout styles. (inline mode must position its overlay.) */
  unstyled?: boolean;
  labels?: { match?: string; mismatch?: string };
  /** true = match, false = mismatch, null = not enough input. */
  onChange?: (match: boolean | null) => void;
  /** Called when inline glyphs can't be shown and the field keeps its normal dots. */
  onFallback?: (reason: string) => void;
  mount?: (input: HTMLInputElement, glyph: HTMLCanvasElement, which: 'password' | 'confirm') => void;
  mountStatus?: (status: HTMLElement) => void;
  crypto?: Crypto;
  /** TESTING ONLY: use this salt instead of a fresh random one. Never set it in production. */
  unsafeSalt?: Uint8Array;
  /**
   * When true, append a small unobtrusive credit link ("Built with passglyph").
   * Off by default — MIT needs no attribution. Fixed text only (no derived data).
   * Uses class `passglyph-credit` (no inline styles; CSP-safe). No network or tracking.
   */
  credit?: boolean;
  /** Element or CSS selector to append the credit link into. Default: after the status / glyph area. */
  creditTarget?: HTMLElement | string;
}

export type Detach = () => void;

const hide = (s: CSSStyleDeclaration) => {
  s.position = 'absolute'; s.width = s.height = '1px'; s.margin = '-1px'; s.padding = '0';
  s.overflow = 'hidden'; s.clip = 'rect(0 0 0 0)'; s.whiteSpace = 'nowrap'; s.border = '0';
};
const canvas2d = (c: HTMLCanvasElement) => { try { return c.getContext && c.getContext('2d'); } catch { return null; } };

/**
 * Show matching glyphs for a password field and its confirmation.
 * Returns a function that removes everything passglyph added and restores the inputs.
 */
export function attach(password: HTMLInputElement, confirm: HTMLInputElement, opts: PassGlyphOptions = {}): Detach {
  const doc = password.ownerDocument, win: any = doc.defaultView || {}, C = opts.crypto || globalThis.crypto;
  const inline = opts.mode != 'badge', min = Math.max(4, Math.floor(opts.minLength ?? 8));
  const wait = Math.max(100, opts.debounce ?? 300), dpr = Math.min(3, win.devicePixelRatio || 1);
  const lab = { match: 'Passwords match', mismatch: "Passwords don't match", ...opts.labels };
  const cleanups: (() => void)[] = [];
  let dead = false, last: boolean | null | undefined, at: any;
  const on = (t: EventTarget, e: string, f: any) => { t.addEventListener(e, f); cleanups.push(() => t.removeEventListener(e, f)); };
  const ink = (el: Element) => (win.getComputedStyle && win.getComputedStyle(el).color) || '#6b7280';
  const fall = (r: string) => opts.onFallback && opts.onFallback(r);

  // accessible match state, shared by both modes (compares the values; no crypto involved)
  const status = doc.createElement('span');
  status.className = 'passglyph-sr';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  if (!opts.unstyled) hide(status.style);
  let marker: HTMLCanvasElement | null = null;
  const announce = () => {
    const a = password.value, b = confirm.value;
    const m = a.length >= min && b.length >= min ? a === b : null;
    if (m === last) return;
    last = m;
    status.textContent = m == null ? '' : m ? lab.match : lab.mismatch;
    if (marker) { marker.classList.toggle('passglyph-match', m === true); marker.classList.toggle('passglyph-mismatch', m === false); }
    opts.onChange && opts.onChange(m);
  };
  const later = () => { clearTimeout(at); at = setTimeout(() => !dead && announce(), wait); };
  cleanups.push(() => clearTimeout(at));
  for (const i of [password, confirm]) { on(i, 'input', later); on(i, 'change', later); }

  let salt: Uint8Array | null = null;
  try { salt = opts.unsafeSalt ? opts.unsafeSalt.slice() : createSalt(C); } catch { fall('webcrypto'); }

  const cvs: HTMLCanvasElement[] = [];
  const mk = (cls: string) => { const c = doc.createElement('canvas'); c.className = cls; c.setAttribute('aria-hidden', 'true'); cvs.push(c); return c; };

  if (salt && !inline) {
    // ---- badge mode (v1): one PBKDF2 glyph per field ----
    const bits = clampBits(opts.bits ?? 10), iters = opts.iterations ?? DEFAULT_ITERATIONS, budget = Math.max(0, opts.budget ?? 250), size = opts.size || 20;
    const s = salt;
    [password, confirm].forEach((input, i) => {
      const c = mk('passglyph-glyph');
      c.width = c.height = Math.round(size * dpr);
      if (!opts.unstyled) { const st = c.style; st.width = st.height = size + 'px'; st.verticalAlign = 'middle'; st.marginInlineStart = '6px'; }
      opts.mount ? opts.mount(input, c, i ? 'confirm' : 'password') : input.insertAdjacentElement('afterend', c);
      if (i) marker = c;
      const draw = (ops: ReturnType<typeof neutralOps>) => { const ctx = canvas2d(c), P = win.Path2D; if (ctx && P) paint(ctx, P, ops, size, dpr); };
      draw(neutralOps(ink(c)));
      let gen = 0, t: any;
      const update = async (g: number) => {
        const t0 = Date.now(), v = input.value, long = v.length >= min;
        const idx = await deriveIndex(long ? v : '\u0000'.repeat(min), s, bits, iters, C);
        const rest = budget - (Date.now() - t0);
        if (rest > 0) await new Promise((r) => setTimeout(r, rest));
        if (dead || g != gen) return;
        draw(long ? glyphOps(idx, bits, ink(c)) : neutralOps(ink(c)));
      };
      const sched = () => { clearTimeout(t); const g = ++gen; t = setTimeout(() => update(g), wait); };
      on(input, 'input', sched); on(input, 'change', sched);
      cleanups.push(() => clearTimeout(t));
      if (input.value) sched();
    });
  } else if (salt) {
    // ---- inline mode: hieroglyphs replace the masking dots ----
    const bits = clampGlyphBits(opts.bits ?? 5), em = opts.size || 1.1, P = win.Path2D;
    const keyP = instanceKey(salt, C); salt = null;
    const paths: any[] = [];
    const glyph = (i: number) => (paths[i] ||= new P(hieroglyphPath(i)));
    const firefox = /Firefox\//.test(win.navigator?.userAgent || '');
    [password, confirm].forEach((input, i) => {
      const c = mk('passglyph-overlay'), ctx = canvas2d(c);
      if (!ctx || !P || typeof ctx.measureText != 'function') { cvs.pop(); return fall('canvas'); }
      const st = input.style, saved = [st.color, st.getPropertyValue('-webkit-text-fill-color'), st.caretColor, st.letterSpacing];
      const had = input.hasAttribute('style');
      cleanups.push(() => { st.color = saved[0]; st.setProperty('-webkit-text-fill-color', saved[1]); st.caretColor = saved[2]; st.letterSpacing = saved[3]; if (!had && !st.length) input.removeAttribute('style'); });
      const cs = win.getComputedStyle(input), fg = cs.color || '#000';
      const os = c.style; os.position = 'absolute'; os.pointerEvents = 'none';
      opts.mount ? opts.mount(input, c, i ? 'confirm' : 'password') : input.insertAdjacentElement('afterend', c);
      let seq: number[] = [], gen = 0, cell = 16, composing = false, raf = 0;
      const mask = (v: boolean) => { st.color = v ? 'transparent' : saved[0]; st.setProperty('-webkit-text-fill-color', v ? 'transparent' : saved[1]); st.caretColor = v ? fg : saved[2]; };
      const layout = () => {
        const s = win.getComputedStyle(input), fs = parseFloat(s.fontSize) || 16;
        ctx.font = s.font || `${s.fontSize} ${s.fontFamily}`;
        const bw = ctx.measureText(firefox ? '\u25cf' : '\u2022').width || fs * 0.6;
        cell = Math.max(bw, fs * em);
        st.letterSpacing = (cell - bw).toFixed(2) + 'px';
        const w = input.clientWidth, h = input.clientHeight;
        os.left = input.offsetLeft + input.clientLeft + 'px'; os.top = input.offsetTop + input.clientTop + 'px';
        os.width = w + 'px'; os.height = h + 'px';
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        draw();
      };
      const draw = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        if (composing || !seq.length) return;
        const s = win.getComputedStyle(input), w = input.clientWidth, h = input.clientHeight;
        const rtl = s.direction == 'rtl', pl = parseFloat(s.paddingLeft) || 0, pr = parseFloat(s.paddingRight) || 0;
        const g = Math.min(cell, h || cell) * 0.86, y = ((h || cell) - g) / 2, sl = input.scrollLeft || 0;
        ctx.fillStyle = fg;
        seq.forEach((v, k) => {
          const x = rtl ? w - pr - (k + 1) * cell - sl : pl + k * cell - sl;
          if (w && (x + cell < 0 || x > w)) return;
          ctx.setTransform((dpr * g) / 32, 0, 0, (dpr * g) / 32, dpr * (x + (cell - g) / 2), dpr * y);
          ctx.fill(glyph(v));
        });
      };
      const frame = () => { if (!raf) raf = (win.requestAnimationFrame || setTimeout)(() => { raf = 0; !dead && draw(); }); };
      const update = async () => {
        const g = ++gen, v = input.value;
        const s = v ? await glyphSequence(await keyP, v, bits, C) : [];
        if (dead || g != gen) return;
        seq = s; draw();
      };
      mask(true); layout();
      on(input, 'input', update); on(input, 'change', update);
      for (const e of ['scroll', 'select', 'keyup', 'keydown', 'focus', 'blur', 'mouseup', 'pointerup']) on(input, e, frame);
      on(doc, 'selectionchange', frame);
      on(win, 'resize', layout);
      on(input, 'compositionstart', () => { composing = true; mask(false); draw(); });
      on(input, 'compositionend', () => { composing = false; mask(true); update(); });
      if (win.ResizeObserver) { const ro = new win.ResizeObserver(layout); ro.observe(input); cleanups.push(() => ro.disconnect()); }
      if (input.value) update();
    });
    keyP.catch(() => { fall('webcrypto'); cleanups.splice(0).forEach((f) => f()); cvs.forEach((c) => c.remove()); });
  }

  const anchor = marker || (cvs.length ? cvs[cvs.length - 1] : confirm);
  opts.mountStatus ? opts.mountStatus(status) : anchor.insertAdjacentElement('afterend', status);
  if (password.value || confirm.value) later();

  let creditEl: HTMLAnchorElement | null = null;
  if (opts.credit) {
    creditEl = doc.createElement('a');
    creditEl.className = 'passglyph-credit';
    creditEl.href = 'https://louiswright.co.uk';
    creditEl.rel = 'noopener';
    creditEl.textContent = 'Built with passglyph';
    const t = opts.creditTarget;
    const target = typeof t == 'string' ? doc.querySelector(t) : t;
    if (target) target.appendChild(creditEl);
    else status.insertAdjacentElement('afterend', creditEl);
  }

  return () => {
    dead = true;
    cleanups.splice(0).forEach((f) => f());
    cvs.forEach((c) => c.remove());
    status.remove();
    creditEl?.remove();
  };
}

export default attach;
