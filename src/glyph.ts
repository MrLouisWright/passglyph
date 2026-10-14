/**
 * Glyph alphabet: up to 12 bits → shape (3) · colour (3) · inner mark (2) · pips (2) · frame (2).
 * Every glyph is a list of SVG path ops in a 32×32 box; the same ops render to canvas (via Path2D) or SVG.
 * Shape and mark carry 5 bits on their own, so colour is never the only cue.
 */

export const MAX_BITS = 12;
export const MIN_BITS = 4;
/** Okabe–Ito colour-blind-safe palette (black swapped for grey so it shows on dark backgrounds). */
export const COLOURS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#8C8C8C'];
const DARK_MARK = [0, 1, 3, 7]; // light fills get a dark mark

const poly = (n: number, r: number, rot = -90, inner = 0) => {
  let d = '';
  const k = inner ? n * 2 : n;
  for (let i = 0; i < k; i++) {
    const a = ((rot + (i * 360) / k) * Math.PI) / 180, rr = inner && i % 2 ? inner : r;
    d += (i ? 'L' : 'M') + (16 + rr * Math.cos(a)).toFixed(2) + ' ' + (16 + rr * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
};
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const SHAPES = [
  circ(16, 16, 10), 'M7 7h18v18H7Z', poly(3, 12, -90), poly(4, 11.5, -90), poly(5, 11), poly(6, 11, 0), poly(5, 12, -90, 5.2),
  'M12.5 5h7v7.5H27v7h-7.5V27h-7v-7.5H5v-7h7.5Z',
];
export const SHAPE_NAMES = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'plus'];
const MARKS = ['', circ(16, 17, 2.8), 'M11 15.6h10v2.8H11Z', circ(16, 17, 4) + circ(16, 17, 2.2)];
const PIPS = [[29.5, 29.5], [29.5, 24.5], [24.5, 29.5]];
const FRAMES = ['', 'M1.5 4.5a3 3 0 0 1 3-3h23a3 3 0 0 1 3 3v23a3 3 0 0 1-3 3h-23a3 3 0 0 1-3-3Z', circ(16, 16, 14.8), 'M1.5 7V1.5H7M25 1.5h5.5V7'];

export interface Op { d: string; fill?: string; stroke?: string; w?: number; dash?: number[]; evenodd?: boolean }

export const clampBits = (b: unknown): number => Math.max(MIN_BITS, Math.min(MAX_BITS, Math.floor(Number(b)) || 10));

/** Split an index into components; components that get no bits stay at 0. */
export const decompose = (index: number, bits: number) => {
  const sizes = [3, 3, 2, 2, 2], out: number[] = [];
  let left = clampBits(bits), v = index & ((1 << left) - 1);
  for (const s of sizes) { const t = Math.min(s, left); out.push(v & ((1 << t) - 1)); v >>>= t; left -= t; }
  return { shape: out[0], colour: out[1], mark: out[2], pips: out[3], frame: out[4] };
};

/** Drawing ops for glyph `index` at `bits` of entropy. `ink` colours frame, pips and outline. */
export const glyphOps = (index: number, bits: number, ink = '#6b7280'): Op[] => {
  const g = decompose(index, bits), fill = COLOURS[g.colour];
  const ops: Op[] = [{ d: SHAPES[g.shape], fill, stroke: ink, w: 1.2 }];
  if (g.mark) ops.push({ d: MARKS[g.mark], fill: DARK_MARK.includes(g.colour) ? '#111111' : '#ffffff', evenodd: g.mark == 3 });
  for (let i = 0; i < g.pips; i++) ops.push({ d: circ(PIPS[i][0], PIPS[i][1], 1.7), fill: ink });
  if (g.frame) ops.push({ d: FRAMES[g.frame], stroke: ink, w: 1.4 });
  return ops;
};

/** The neutral glyph shown for short input: identical for every value below minLength. */
export const neutralOps = (ink = '#6b7280'): Op[] => [{ d: circ(16, 16, 10), stroke: ink, w: 1.5, dash: [3, 3] }];

/** SVG markup for documentation/legends. Never used for live password glyphs (those go to canvas only). */
export const opsToSVG = (ops: Op[], size = 32): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">` +
  ops.map((o) => `<path d="${o.d}" fill="${o.fill || 'none'}"${o.evenodd ? ' fill-rule="evenodd"' : ''}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.w}" stroke-linejoin="round"` : ''}${o.dash ? ` stroke-dasharray="${o.dash.join(' ')}"` : ''}/>`).join('') + '</svg>';

/** Paint ops on a 2D context (CSS-pixel `size`, device pixel ratio `dpr`). */
export const paint = (ctx: CanvasRenderingContext2D, P: typeof Path2D, ops: Op[], size: number, dpr = 1) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size * dpr, size * dpr);
  ctx.setTransform((size * dpr) / 32, 0, 0, (size * dpr) / 32, 0, 0);
  for (const o of ops) {
    const p = new P(o.d);
    ctx.setLineDash(o.dash || []);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(p, o.evenodd ? 'evenodd' : 'nonzero'); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 1; ctx.lineJoin = 'round'; ctx.stroke(p); }
  }
};
