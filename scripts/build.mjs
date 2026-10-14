import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import esbuild from 'esbuild';

// sub-entries import the core as a sibling file so the core is loaded once
const coreExt = (format) => ({ name: 'core-external', setup(b) { b.onResolve({ filter: /^\.\/index\.js$/ }, () => ({ path: format == 'esm' ? './index.mjs' : './index.cjs', external: true })); } });

fs.rmSync('dist', { recursive: true, force: true });
const entries = ['index', 'element', 'react', 'vue'];
const common = { bundle: true, target: 'es2019', minify: true, legalComments: 'none' };
for (const e of entries) {
  const platform = 'neutral';
  for (const [format, ext] of [['esm', 'mjs'], ['cjs', 'cjs']])
    await esbuild.build({ ...common, entryPoints: [`src/${e}.ts`], outfile: `dist/${e}.${ext}`, format, platform, mainFields: ['module', 'main'], external: ['react', 'vue'], ...(e == 'index' ? {} : { plugins: [coreExt(format)] }) });
}
await esbuild.build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/passglyph.global.js', format: 'iife', globalName: 'passglyph' });
await esbuild.build({ ...common, entryPoints: ['src/element.ts'], outfile: 'dist/passglyph-element.global.js', format: 'iife' });
execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
for (const f of fs.readdirSync('dist').filter((f) => f.endsWith('.d.ts'))) fs.writeFileSync(`dist/${f.replace('.d.ts', '.d.cts')}`, fs.readFileSync(`dist/${f}`, 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from './$1.cjs'"));
const gz = gzipSync(fs.readFileSync('dist/index.mjs'), { level: 9 }).length;
console.log(`build: dist/ ok — core ${fs.statSync('dist/index.mjs').size} B min, ${gz} B min+gz`);
