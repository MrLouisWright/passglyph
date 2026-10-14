# passglyph — plan

1. Threat model first: SECURITY-DESIGN.md (done before code).
2. Core: `src/derive.ts` (salt, PBKDF2), `src/glyph.ts` (alphabet as SVG path ops, canvas painter), `src/index.ts` (`attach`).
3. Wrappers: `src/element.ts` (`<pass-glyph>`), `src/react.ts`, `src/vue.ts` (optional peers, core external).
4. Tests that enforce the design: salt uniqueness, entropy cap, DOM-independence of the password, no network/storage, CSP, timing, a11y.
5. Same house style as favipulse / workflow-sentinel: README, docs/ site on the shared theme (deployed by Actions), wiki, SHA-pinned least-privilege CI (Node 18/20/22) + release (GitHub Packages; npm gated by `NPM_PUBLISH`).
6. Ship: repo → CI green → Pages → `publish-nofallback.sh` v1.0.0 → reset homepage → queue on npm-pending.
