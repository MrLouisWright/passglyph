// docs/hero.svg: README banner made from the real glyph alphabet (static illustration, random indices).
import { writeFileSync } from 'node:fs';
import { glyphOps, neutralOps, opsToSVG } from '../dist/index.mjs';
const g = (ops, x, y) => `<g transform="translate(${x} ${y}) scale(1.25)">${opsToSVG(ops).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`;
const field = (y, label, dots, ops, note, col) => `<text x="40" y="${y - 10}" font-size="14" fill="#b4b8bf">${label}</text><rect x="40" y="${y}" width="420" height="44" rx="10" fill="#0f1114" stroke="#2a2e35"/><text x="58" y="${y + 29}" font-size="20" fill="#ededef" letter-spacing="3">${'•'.repeat(dots)}</text>${g(ops, 476, y + 2)}${note ? `<text x="530" y="${y + 28}" font-size="14" fill="${col}">${note}</text>` : ''}`;
const a = glyphOps(613, 10, '#9ca3af'), b = glyphOps(201, 10, '#9ca3af');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" width="760" height="300" font-family="system-ui,-apple-system,Segoe UI,sans-serif"><rect width="760" height="300" rx="18" fill="#0a0b0d"/>` +
  field(50, 'New password', 14, a, '') + field(130, 'Confirm password', 14, a, '✔ same glyph: match', '#6fdc9a') + field(210, 'Confirm password (typo)', 14, b, "✖ different glyph", '#f5c56b') +
  `<text x="40" y="285" font-size="12" fill="#8a8f98">Glyphs are re-salted on every page load, so these exact shapes never mean anything outside this one form.</text></svg>\n`;
writeFileSync('docs/hero.svg', svg); console.log('docs/hero.svg', svg.length);
