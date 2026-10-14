import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const core = readFileSync(new URL('../dist/index.mjs', import.meta.url), 'utf8');

const gz = (f) => gzipSync(readFileSync(new URL('../dist/' + f, import.meta.url)), { level: 9 }).length;
test('size budgets (min+gzip): core < 3.5 KB, badge alphabet < 1.5 KB, hieroglyph sprite < 4 KB', () => {
  assert.ok(gz('index.mjs') < 3584, String(gz('index.mjs')));
  assert.ok(gz('glyph.mjs') < 1536, String(gz('glyph.mjs')));
  assert.ok(gz('hieroglyphs.mjs') < 4096, String(gz('hieroglyphs.mjs')));
});
test('zero runtime dependencies; react/vue optional peers', () => {
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  assert.equal(pkg.peerDependenciesMeta.react.optional, true); assert.equal(pkg.peerDependenciesMeta.vue.optional, true);
  assert.doesNotMatch(readFileSync(new URL('../dist/react.mjs', import.meta.url), 'utf8'), /createElement\("canvas"\)/); // core not duplicated
});
test('static audit of the shipped core + sprite: no network, storage, eval, Math.random, innerHTML', () => {
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\beval\(/, /new Function/, /Math\.random/, /innerHTML/, /<style/])
    for (const f of [core, readFileSync(new URL('../dist/hieroglyphs.mjs', import.meta.url), 'utf8'), readFileSync(new URL('../dist/glyph.mjs', import.meta.url), 'utf8')]) assert.doesNotMatch(f, bad, String(bad));
});
test('CJS and ESM entry points load', async () => {
  assert.equal(typeof require('passglyph').attach, 'function');
  assert.equal(typeof (await import('passglyph')).attach, 'function');
  assert.equal(typeof (await import('passglyph')).default, 'function');
});
test('every export target exists', () => {
  const walk = (v) => (typeof v == 'string' ? [v] : Object.values(v).flatMap(walk));
  for (const f of walk(pkg.exports)) assert.ok(existsSync(new URL('../' + f, import.meta.url)), f);
});
