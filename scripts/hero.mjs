// Generates docs/hero.svg (illustration only — live glyphs are never SVG in the DOM).
import { writeFileSync } from 'node:fs';
import { hieroglyphPath } from '../dist/hieroglyphs.mjs';
const seq = [3, 17, 8, 29, 12, 5, 22, 14, 9, 26], typo = [3, 17, 8, 29, 12, 31, 2, 19, 27, 6];
const cell = 30, g = 22;
const field = (y, label, s, colour, note, bad = -1) => {
  let o = `<text x="40" y="${y - 10}" font-size="14" fill="#374151">${label}</text><rect x="40" y="${y}" width="420" height="48" rx="8" fill="#fff" stroke="${colour}" stroke-width="2"/>`;
  s.forEach((i, k) => { const x = 56 + k * cell; o += `<g transform="translate(${x} ${y + 13}) scale(${g / 32})"><path d="${hieroglyphPath(i)}" fill="${k >= bad && bad >= 0 ? '#b45309' : '#111827'}"/></g>`; });
  return o + `<text x="480" y="${y + 30}" font-size="15" fill="${colour}">${note}</text>`;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 330" font-family="system-ui,sans-serif"><rect width="760" height="330" rx="16" fill="#f8fafc"/>
${field(40, 'Password', seq, '#9ca3af', '')}${field(140, 'Confirm', seq, '#059669', '✓ same sequence')}${field(240, 'Confirm (typo at position 6)', typo, '#b45309', '✗ diverges at 6', 5)}</svg>`;
writeFileSync(new URL('../docs/hero.svg', import.meta.url), svg);
console.log('docs/hero.svg', svg.length, 'bytes');
