import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSalt, deriveIndex, MIN_ITERATIONS } from '../dist/index.mjs';
import { crypto } from './helpers.js';

const hex = (u) => Buffer.from(u).toString('hex');

test('salt: 1000 instances → 1000 unique salts, 128 random bits after the label', () => {
  const s = new Set();
  for (let i = 0; i < 1000; i++) { const x = createSalt(crypto); assert.equal(x.length, 12 + 16); assert.equal(Buffer.from(x.subarray(0, 12)).toString(), 'passglyph/v1'); s.add(hex(x)); }
  assert.equal(s.size, 1000);
});

test('salt comes from crypto.getRandomValues', () => {
  let calls = 0;
  const fake = { subtle: crypto.subtle, getRandomValues: (a) => { calls++; return crypto.getRandomValues(a); } };
  createSalt(fake);
  assert.equal(calls, 1);
});

test('refuses to run without a CSPRNG or SubtleCrypto (never Math.random)', async () => {
  assert.throws(() => createSalt(null), /WebCrypto/);
  assert.throws(() => createSalt({}), /WebCrypto/);
  assert.throws(() => createSalt({ getRandomValues: () => {} }), /WebCrypto/);
  await assert.rejects(deriveIndex('x', new Uint8Array(16), 10, 1e4, { getRandomValues() {} }), /WebCrypto/);
});

test('derivation is deterministic for the same salt', async () => {
  const s = createSalt(crypto);
  assert.equal(await deriveIndex('correct horse', s, 10, 1e4, crypto), await deriveIndex('correct horse', s, 10, 1e4, crypto));
});

test('fresh salts unlink sessions: the same password gives many different glyphs', async () => {
  const seen = new Set();
  for (let i = 0; i < 64; i++) seen.add(await deriveIndex('same password', createSalt(crypto), 10, 1e4, crypto));
  assert.ok(seen.size > 55, `${seen.size}`); // ~62 expected for 64 draws from 1024
});

test('index always < 2^min(bits,12)', async () => {
  const s = createSalt(crypto);
  for (const [b, cap] of [[4, 16], [10, 1024], [12, 4096], [32, 4096]])
    for (let i = 0; i < 20; i++) assert.ok((await deriveIndex('pw' + i, s, b, 1e4, crypto)) < cap);
});

test('uses PBKDF2-SHA-256 with a non-extractable key, ≥ 10 000 iterations, 32 bits', async () => {
  const calls = [];
  const sub = {
    importKey: (...a) => { calls.push(['import', a[2], a[3], a[4]]); return crypto.subtle.importKey(...a); },
    deriveBits: (p, k, n) => { calls.push(['derive', p.name, p.hash, p.iterations, n]); return crypto.subtle.deriveBits(p, k, n); },
  };
  await deriveIndex('x', createSalt(crypto), 10, 5, { getRandomValues: crypto.getRandomValues.bind(crypto), subtle: sub });
  assert.deepEqual(calls, [['import', 'PBKDF2', false, ['deriveBits']], ['derive', 'PBKDF2', 'SHA-256', MIN_ITERATIONS, 32]]);
});

test('derived buffer is zeroed after use', async () => {
  let buf;
  const sub = { importKey: crypto.subtle.importKey.bind(crypto.subtle), deriveBits: async (...a) => (buf = await crypto.subtle.deriveBits(...a)) };
  await deriveIndex('x', createSalt(crypto), 10, 1e4, { getRandomValues: crypto.getRandomValues.bind(crypto), subtle: sub });
  assert.deepEqual([...new Uint8Array(buf)], [0, 0, 0, 0]);
});
