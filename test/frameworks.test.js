import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, type, settle, sleep, FAST } from './helpers.js';

const globals = (w) => { for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'SVGElement', 'MutationObserver']) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k == 'window' ? w : w[k] }); };

test('React: usePassGlyph attaches on mount and detaches on unmount', async () => {
  const p = page({ html: '<div id="root"></div>' }); globals(p.window); globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const { usePassGlyph } = await import('../dist/react.mjs');
  function Form() {
    const a = React.useRef(null), b = React.useRef(null);
    usePassGlyph(a, b, FAST);
    return React.createElement('form', null, React.createElement('input', { ref: a, type: 'password' }), React.createElement('input', { ref: b, type: 'password' }));
  }
  const root = createRoot(p.document.getElementById('root'));
  root.render(React.createElement(Form)); await sleep(30);
  assert.equal(p.document.querySelectorAll('canvas').length, 2);
  const [x, y] = p.document.querySelectorAll('input');
  type(x, 'react-password-1'); type(y, 'react-password-1'); await settle();
  assert.equal(p.document.querySelector('[role=status]').textContent, 'Passwords match');
  root.unmount(); await sleep(10);
  assert.equal(p.document.querySelectorAll('canvas').length, 0);
});

test('Vue: composable and v-pass-glyph directive', async () => {
  const p = page({ html: '<div id="app"></div><div id="app2"></div>' }); globals(p.window);
  const { createApp, h, ref } = await import('vue');
  const { usePassGlyph, vPassGlyph } = await import('../dist/vue.mjs');
  const app = createApp({ setup() { const a = ref(null), b = ref(null); usePassGlyph(a, b, FAST); return () => h('form', [h('input', { ref: a, type: 'password' }), h('input', { ref: b, type: 'password' })]); } });
  app.mount(p.document.getElementById('app')); await sleep(10);
  assert.equal(p.document.querySelectorAll('#app canvas').length, 2);
  const [x, y] = p.document.querySelectorAll('#app input');
  type(x, 'vue-password-123'); type(y, 'vue-password-12'); await settle();
  assert.equal(p.document.querySelector('#app [role=status]').textContent, "Passwords don't match");
  app.unmount(); assert.equal(p.document.querySelectorAll('#app canvas').length, 0);
  const app2 = createApp({ render: () => h('div', [h('input', { type: 'password' }), h('input', { type: 'password' })]) });
  app2.directive('pass-glyph', vPassGlyph);
  app2.component('X', {});
  const { withDirectives, resolveDirective } = await import('vue');
  const app3 = createApp({ render() { return withDirectives(h('div', [h('input', { type: 'password' }), h('input', { type: 'password' })]), [[vPassGlyph, FAST]]); } });
  app3.mount(p.document.getElementById('app2')); await sleep(10);
  assert.equal(p.document.querySelectorAll('#app2 canvas').length, 2);
  app3.unmount(); assert.equal(p.document.querySelectorAll('#app2 canvas').length, 0);
});
