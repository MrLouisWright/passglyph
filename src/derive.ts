/** Salt + keyed derivation. WebCrypto only; refuses to run without a CSPRNG. */
import { clampBits } from './glyph.js';

export const MIN_ITERATIONS = 10_000;
export const DEFAULT_ITERATIONS = 60_000;
const LABEL = new TextEncoder().encode('passglyph/v1');

const need = (c: Crypto | undefined): Crypto => {
  if (!c || typeof c.getRandomValues != 'function' || !c.subtle) throw new Error('passglyph: WebCrypto (crypto.getRandomValues + crypto.subtle) is required');
  return c;
};

/** Fresh salt: "passglyph/v1" ‖ 128 random bits. */
export const createSalt = (c: Crypto | undefined = globalThis.crypto): Uint8Array => {
  const s = new Uint8Array(LABEL.length + 16);
  s.set(LABEL);
  need(c).getRandomValues(s.subarray(LABEL.length));
  return s;
};

/** PBKDF2-HMAC-SHA-256 → glyph index in [0, 2^bits). The derived buffer is zeroed before returning. */
export const deriveIndex = async (value: string, salt: Uint8Array, bits = 10, iterations = DEFAULT_ITERATIONS, c: Crypto | undefined = globalThis.crypto): Promise<number> => {
  const sub = need(c).subtle, b = clampBits(bits);
  const key = await sub.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const buf = await sub.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: Math.max(MIN_ITERATIONS, Math.floor(iterations) || DEFAULT_ITERATIONS) }, key, 32);
  const u = new Uint8Array(buf), idx = (((u[0] << 24) | (u[1] << 16) | (u[2] << 8) | u[3]) >>> 0) >>> (32 - b);
  u.fill(0);
  return idx;
};

export const MIN_GLYPH_BITS = 4;
export const MAX_GLYPH_BITS = 6;
/** Inline mode: bits per position, 4-6 (alphabet of 16-64 hieroglyphs). Default 5. */
export const clampGlyphBits = (b: unknown): number => Math.max(MIN_GLYPH_BITS, Math.min(MAX_GLYPH_BITS, Math.floor(Number(b)) || 5));

/**
 * Per-instance HMAC-SHA-256 key from a salt. The key is non-extractable and the salt bytes are wiped
 * afterwards, so after this call the secret exists only inside the CryptoKey.
 */
export const instanceKey = async (salt: Uint8Array, c: Crypto | undefined = globalThis.crypto): Promise<CryptoKey> => {
  const k = await need(c).subtle.importKey('raw', salt as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  salt.fill(0);
  return k;
};

/**
 * Glyph index for every position: g[i] = HMAC(key, prefix[0..i]) truncated to `bits`.
 * Positions are Unicode code points. Each prefix is hashed whole, so repeated characters
 * don't repeat glyphs and the sequences diverge from the first differing position on.
 */
export const glyphSequence = async (key: CryptoKey, value: string, bits = 5, c: Crypto | undefined = globalThis.crypto): Promise<number[]> => {
  const sub = need(c).subtle, b = clampGlyphBits(bits), cps = Array.from(value), enc = new TextEncoder();
  let p = '';
  const prefixes = cps.map((ch) => (p += ch));
  return Promise.all(prefixes.map(async (s) => {
    const u = new Uint8Array(await sub.sign('HMAC', key, enc.encode(s)));
    const v = u[0] >>> (8 - b);
    u.fill(0);
    return v;
  }));
};
