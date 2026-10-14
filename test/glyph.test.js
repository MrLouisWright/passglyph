import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glyphOps, neutralOps, decompose, clampBits, opsToSVG, COLOURS, SHAPES, MAX_BITS } from '../dist/index.mjs';

test('clampBits: default 10, hard cap 12, floor 4', () => {
  assert.equal(clampBits(undefined), 10);
  assert.equal(clampBits(10), 10);
  assert.equal(clampBits(12), 12);
  assert.equal(clampBits(13), 12);
  assert.equal(clampBits(64), 12);
  assert.equal(clampBits(Infinity), 12);
  assert.equal(clampBits(1), 4);
  assert.equal(clampBits(-5), 4);
  assert.equal(clampBits('abc'), 10);
  assert.equal(MAX_BITS, 12);
});

test('entropy cap: never more than 2^12 distinct glyphs, even when asked for more', () => {
  const seen = new Set();
  for (let i = 0; i < 1 << 14; i++) seen.add(opsToSVG(glyphOps(i, 20)));
  assert.equal(seen.size, 4096);
});

test('each bit setting gives exactly 2^bits distinct glyphs', () => {
  for (const b of [4, 6, 8, 10]) {
    const seen = new Set();
    for (let i = 0; i < 1 << b; i++) seen.add(opsToSVG(glyphOps(i, b)));
    assert.equal(seen.size, 1 << b, `bits ${b}`);
  }
});

test('decompose allocates shape, colour, mark, pips, frame in order', () => {
  assert.deepEqual(decompose(0b111, 3), { shape: 7, colour: 0, mark: 0, pips: 0, frame: 0 });
  assert.deepEqual(decompose(0b101_110, 6), { shape: 6, colour: 5, mark: 0, pips: 0, frame: 0 });
  assert.deepEqual(decompose(0xfff, 12), { shape: 7, colour: 7, mark: 3, pips: 3, frame: 3 });
});

test('not colour-only: without colour, shape+mark still distinguish 32 glyphs at 10 bits', () => {
  const noColour = new Set();
  for (let i = 0; i < 1024; i++) noColour.add(JSON.stringify(glyphOps(i, 10).map((o) => [o.d, o.stroke])));
  assert.ok(noColour.size >= 128, String(noColour.size)); // shape × mark × pips without fills
});

test('palette is Okabe–Ito (8 colours) and 8 distinct shapes', () => {
  assert.equal(new Set(COLOURS).size, 8);
  assert.ok(COLOURS.includes('#E69F00') && COLOURS.includes('#0072B2'));
  assert.equal(new Set(SHAPES).size, 8);
});

test('neutral glyph is constant and not in the glyph space', () => {
  assert.deepEqual(neutralOps(), neutralOps());
  const n = opsToSVG(neutralOps());
  for (let i = 0; i < 1024; i++) assert.notEqual(opsToSVG(glyphOps(i, 10)), n);
});

test('opsToSVG is aria-hidden SVG', () => {
  assert.match(opsToSVG(glyphOps(5, 10)), /^<svg[^>]+aria-hidden="true"/);
});
