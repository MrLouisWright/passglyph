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
