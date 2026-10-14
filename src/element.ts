/**
 * <pass-glyph> custom element. Import 'passglyph/element' to register it.
 *
 *   <pass-glyph bits="10" min-length="8">
 *     <input type="password" autocomplete="new-password">
 *     <input type="password" autocomplete="new-password">
 *   </pass-glyph>
 *
 * or by id: <pass-glyph for="pw" confirm="pw2"></pass-glyph>
 */
import { attach, type Detach, type PassGlyphOptions } from './index.js';

const num = (el: Element, a: string) => (el.hasAttribute(a) ? Number(el.getAttribute(a)) : undefined);

export const defineElement = (name = 'pass-glyph', reg: CustomElementRegistry | undefined = typeof customElements != 'undefined' ? customElements : undefined, Base: typeof HTMLElement = typeof HTMLElement != 'undefined' ? HTMLElement : (class {} as any)) => {
  if (!reg || reg.get(name)) return reg?.get(name);
  class PassGlyphElement extends Base {
    static observedAttributes = ['mode', 'bits', 'min-length', 'iterations', 'for', 'confirm'];
    options: PassGlyphOptions = {};
    private off?: Detach;
    connectedCallback() { queueMicrotask(() => this.isConnected && this.start()); }
    disconnectedCallback() { this.off?.(); this.off = undefined; }
    attributeChangedCallback() { if (this.off) { this.off(); this.start(); } }
    private start() {
      this.off?.(); this.off = undefined;
      const root = this.getRootNode() as Document | ShadowRoot, f = this.getAttribute('for'), c = this.getAttribute('confirm');
      const ins = f && c ? [root.getElementById(f), root.getElementById(c)] : [...this.querySelectorAll('input[type="password"]')];
      const [a, b] = ins as HTMLInputElement[];
      if (!a || !b) return;
      this.off = attach(a, b, {
        ...this.options, mode: (this.getAttribute('mode') as any) || this.options.mode, bits: num(this, 'bits') ?? this.options.bits, minLength: num(this, 'min-length') ?? this.options.minLength,
        iterations: num(this, 'iterations') ?? this.options.iterations,
        onChange: (m) => { const CE = (this.ownerDocument.defaultView as any)?.CustomEvent || CustomEvent; this.dispatchEvent(new CE('passglyph-change', { detail: { match: m } })); this.options.onChange?.(m); },
      });
    }
  }
  reg.define(name, PassGlyphElement);
  return PassGlyphElement;
};

defineElement();
