import { clampBits, glyphOps, neutralOps, paint } from './glyph.js';
import { createSalt, deriveIndex, DEFAULT_ITERATIONS } from './derive.js';

export * from './glyph.js';
export * from './derive.js';

export interface PassGlyphOptions {
  /** Bits of entropy shown per glyph, 4-12 (hard cap 12). Default 10. */
  bits?: number;
  /** Below this length a fixed neutral glyph is shown and nothing is announced. Default 8, minimum 4. */
  minLength?: number;
  /** PBKDF2 iterations (minimum 10 000). Default 60 000. */
  iterations?: number;
  /** Quiet time after the last input before updating, ms (minimum 100). Default 300. */
  debounce?: number;
  /** Fixed repaint budget after the debounce, ms, so timing doesn't depend on the input. Default 250. */
  budget?: number;
  /** Glyph size in CSS pixels. Default 20. */
  size?: number;
  /** Don't set any inline layout styles; style `.passglyph-glyph` / `.passglyph-sr` yourself. */
  unstyled?: boolean;
  /** Announcements for the live region. */
  labels?: { match?: string; mismatch?: string };
  /** Called after each settled update: true = match, false = mismatch, null = not enough input. */
  onChange?: (match: boolean | null) => void;
  /** Insert a glyph canvas for an input. Default: right after the input. */
  mount?: (input: HTMLInputElement, glyph: HTMLCanvasElement, which: 'password' | 'confirm') => void;
  /** Where to put the live region. Default: after the confirm glyph. */
  mountStatus?: (status: HTMLElement) => void;
  /** WebCrypto implementation. Default `globalThis.crypto`. */
  crypto?: Crypto;
}

export type Detach = () => void;

const hide = (s: CSSStyleDeclaration) => {
  s.position = 'absolute'; s.width = s.height = '1px'; s.margin = '-1px'; s.padding = '0';
  s.overflow = 'hidden'; s.clip = 'rect(0 0 0 0)'; s.whiteSpace = 'nowrap'; s.border = '0';
};

/**
 * Show matching glyphs next to a password field and its confirmation.
 * Returns a function that removes everything passglyph added.
 */
export function attach(password: HTMLInputElement, confirm: HTMLInputElement, opts: PassGlyphOptions = {}): Detach {
  const salt = createSalt(opts.crypto || globalThis.crypto); // throws without a CSPRNG
  const doc = password.ownerDocument, win: any = doc.defaultView || {};
  const bits = clampBits(opts.bits ?? 10), min = Math.max(4, Math.floor(opts.minLength ?? 8));
  const iters = opts.iterations ?? DEFAULT_ITERATIONS, wait = Math.max(100, opts.debounce ?? 300), budget = Math.max(0, opts.budget ?? 250);
  const size = opts.size || 20, dpr = Math.min(3, win.devicePixelRatio || 1);
  const lab = { match: 'Passwords match', mismatch: "Passwords don't match", ...opts.labels };
  const C = opts.crypto || globalThis.crypto;
  const gens = [0, 0];
  let dead = false, last: boolean | null | undefined;
  const timers: any[] = [];

  const status = doc.createElement('span');
  status.className = 'passglyph-sr';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  if (!opts.unstyled) hide(status.style);

  const field = (input: HTMLInputElement, which: 'password' | 'confirm', i: number) => {
    const c = doc.createElement('canvas');
    c.className = 'passglyph-glyph';
    c.setAttribute('aria-hidden', 'true');
    c.width = c.height = Math.round(size * dpr);
    if (!opts.unstyled) { const s = c.style; s.width = s.height = size + 'px'; s.verticalAlign = 'middle'; s.marginInlineStart = '6px'; }
    opts.mount ? opts.mount(input, c, which) : input.insertAdjacentElement('afterend', c);
    const draw = (ops: ReturnType<typeof neutralOps>) => {
      const ctx = c.getContext && c.getContext('2d'), P = win.Path2D;
      if (!ctx || !P) return; // fail closed: no canvas → no glyph
      paint(ctx, P, ops, size, dpr);
    };
    const ink = () => (win.getComputedStyle && win.getComputedStyle(c).color) || '#6b7280';
    draw(neutralOps(ink()));
    const update = async (g: number) => {
      const t0 = Date.now(), v = input.value, long = v.length >= min;
      // always derive (constant work per settled input); short values are discarded
      const idx = await deriveIndex(long ? v : '\u0000'.repeat(min), salt, bits, iters, C);
      const rest = budget - (Date.now() - t0);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
      if (dead || g != gens[i]) return;
      draw(long ? glyphOps(idx, bits, ink()) : neutralOps(ink()));
      announce();
    };
    const on = () => { clearTimeout(timers[i]); const g = ++gens[i]; timers[i] = setTimeout(() => update(g), wait); };
    input.addEventListener('input', on);
    input.addEventListener('change', on);
    return { c, on, input };
  };

  const announce = () => {
    const a = password.value, b = confirm.value;
    const m = a.length >= min && b.length >= min ? a === b : null;
    if (m === last) return;
    last = m;
    status.textContent = m == null ? '' : m ? lab.match : lab.mismatch;
    const cl = fields[1].c.classList;
    cl.toggle('passglyph-match', m === true);
    cl.toggle('passglyph-mismatch', m === false);
    opts.onChange && opts.onChange(m);
  };

  const fields = [field(password, 'password', 0), field(confirm, 'confirm', 1)];
  opts.mountStatus ? opts.mountStatus(status) : fields[1].c.insertAdjacentElement('afterend', status);
  // values present before attach (autofill, back/forward cache)
  if (password.value || confirm.value) fields.forEach((f) => f.on());

  return () => {
    dead = true;
    timers.forEach(clearTimeout);
    for (const f of fields) { f.input.removeEventListener('input', f.on); f.input.removeEventListener('change', f.on); f.c.remove(); }
    status.remove();
  };
}

export default attach;
