/** React hook. `react` is an optional peer dependency; passglyph ships no runtime dependencies. */
import { useEffect } from 'react';
import { attach, type PassGlyphOptions } from './index.js';

type Ref = { current: HTMLInputElement | null };

/**
 *   const pw = useRef(null), confirm = useRef(null);
 *   usePassGlyph(pw, confirm, { bits: 10 });
 */
export function usePassGlyph(password: Ref, confirm: Ref, opts: PassGlyphOptions = {}): void {
  const { bits, minLength, iterations, size, debounce } = opts;
  useEffect(() => {
    if (!password.current || !confirm.current) return;
    return attach(password.current, confirm.current, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, confirm, bits, minLength, iterations, size, debounce]);
}
export default usePassGlyph;
