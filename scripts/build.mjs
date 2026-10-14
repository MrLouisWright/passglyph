import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import esbuild from 'esbuild';

// sub-entries import the core as a sibling file so the core is loaded once
const coreExt = (format, e) => ({ name: 'core-external', setup(b) { b.onResolve({ filter: /^\.\/(index|hieroglyphs|glyph)\.js$/ }, (a) => (e == 'index' && a.path == './index.js' ? undefined : { path: './' + a.path.slice(2, -3) + (format == 'esm' ? '.mjs' : '.cjs'), external: true })); } });

fs.rmSync('dist', { recursive: true, force: true });
const entries = ['index', 'glyph', 'hieroglyphs', 'element', 'react', 'vue'];
const common = { bundle: true, target: 'es2019', minify: true, legalComments: 'none' };
for (const e of entries) {
  const platform = 'neutral';
  for (const [format, ext] of [['esm', 'mjs'], ['cjs', 'cjs']])
    await esbuild.build({ ...common, entryPoints: [`src/${e}.ts`], outfile: `dist/${e}.${ext}`, format, platform, mainFields: ['module', 'main'], external: ['react', 'vue'], ...(e == 'hieroglyphs' || e == 'glyph' ? {} : { plugins: [coreExt(format, e)] }) });
}
await esbuild.build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/passglyph.global.js', format: 'iife', globalName: 'passglyph' });
await esbuild.build({ ...common, entryPoints: ['src/element.ts'], outfile: 'dist/passglyph-element.global.js', format: 'iife' });
execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
for (const f of fs.readdirSync('dist').filter((f) => f.endsWith('.d.ts'))) fs.writeFileSync(`dist/${f.replace('.d.ts', '.d.cts')}`, fs.readFileSync(`dist/${f}`, 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.cjs'"));
const gz = (f) => gzipSync(fs.readFileSync(f), { level: 9 }).length;
console.log(`build: dist/ ok — core ${fs.statSync('dist/index.mjs').size} B min, ${gz('dist/index.mjs')} B gz; badge alphabet ${gz('dist/glyph.mjs')} B gz; sprite ${fs.statSync('dist/hieroglyphs.mjs').size} B min, ${gz('dist/hieroglyphs.mjs')} B gz; global ${gz('dist/passglyph.global.js')} B gz`);
