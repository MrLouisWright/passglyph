/** Vue 3 composable + directive. `vue` is an optional peer dependency. */
import { onMounted, onBeforeUnmount, type Ref } from 'vue';
import { attach, type Detach, type PassGlyphOptions } from './index.js';

/**
 *   const pw = ref(), confirm = ref();
 *   usePassGlyph(pw, confirm, { bits: 10 });
 */
export function usePassGlyph(password: Ref<HTMLInputElement | null | undefined>, confirm: Ref<HTMLInputElement | null | undefined>, opts: PassGlyphOptions = {}): void {
  let off: Detach | undefined;
  onMounted(() => { if (password.value && confirm.value) off = attach(password.value, confirm.value, opts); });
  onBeforeUnmount(() => { off?.(); off = undefined; });
}

const offs = new WeakMap<Element, Detach>();
/** `<div v-pass-glyph="{ bits: 10 }">` around two password inputs. */
export const vPassGlyph = {
  mounted(el: HTMLElement, b: { value?: PassGlyphOptions }) {
    const [a, c] = el.querySelectorAll<HTMLInputElement>('input[type="password"]');
    if (a && c) offs.set(el, attach(a, c, b.value || {}));
  },
  beforeUnmount(el: HTMLElement) { offs.get(el)?.(); offs.delete(el); },
};
export default usePassGlyph;
