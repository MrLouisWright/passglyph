import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const core = readFileSync(new URL('../dist/index.mjs', import.meta.url), 'utf8');

test('core < 3 KB min+gzip', () => { const n = gzipSync(core, { level: 9 }).length; assert.ok(n < 3072, String(n)); });
test('zero runtime dependencies; react/vue optional peers', () => {
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  assert.equal(pkg.peerDependenciesMeta.react.optional, true); assert.equal(pkg.peerDependenciesMeta.vue.optional, true);
  assert.doesNotMatch(readFileSync(new URL('../dist/react.mjs', import.meta.url), 'utf8'), /createElement\("canvas"\)/); // core not duplicated
});
test('static audit of the shipped core: no network, storage, eval, Math.random, innerHTML', () => {
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\beval\(/, /new Function/, /Math\.random/, /innerHTML/, /<style/])
    assert.doesNotMatch(core, bad, String(bad));
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
