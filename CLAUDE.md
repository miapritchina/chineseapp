# Repo Development Guide

Two small static web apps deployed together via GitHub Pages:

- `palette/` — Watercolor painting app with pigment-based color mixing.
- `chinese/` — Chinese character learning app (strokes, etymology, components).

The root `index.html` is a landing page linking to both. There is also an unused
Vite + React scaffold in `src/` (from an earlier project) — **it is not built or
deployed**, only static files under the two app folders plus the root landing.

## File structure

```
/
├── index.html                       landing: links to both apps
├── palette/
│   ├── palette.html                 main app (single file, self-contained except mixbox)
│   ├── mixbox.js                    mixbox pigment-mixing library (external dep)
│   ├── reference.html               static watercolor reference for comparisons
│   ├── test-paint.mjs               playwright paint-stroke test
│   └── test-mobile.mjs              playwright mobile-layout test
├── chinese/
│   ├── index.html                   app shell (card grid + detail modal)
│   ├── styles.css                   layout + component-role color tokens
│   ├── app.js                       IIFE: render, modal stack, HanziWriter, mnemonics
│   └── data.json                    pre-extracted lexicon data (committed)
├── scripts/
│   └── extract-chinese.mjs          one-shot Node script: chinese-lexicon → data.json
└── .github/workflows/pages.yml      GitHub Pages deploy
```

## `palette/` — watercolor app

Single-file HTML app. All logic is an IIFE inside `palette.html`. Relies on
`mixbox.js` sitting next to it (relative `<script src="mixbox.js">`).

Key components:
1. **Color palette** — 12 pigment swatches with dry-paint texture.
2. **Mixing wells** — 2D canvas with per-pixel latent-space color mixing via mixbox.
3. **Drawing canvas** — WebGL fluid simulation for watercolor physics.
4. **Water jar** — Tap to dilute brush, hold to clean.

WebGL watercolor engine (`FluidSim` class):
- Velocity field with advected Navier-Stokes + pressure solve (20 Jacobi iterations).
- Dye field stores pigment absorption, not RGB.
- Wetness field tracks paper water; dries edges inward.
- Paper texture is procedural noise for dry-brush + granulation.
- Capillary flow migrates pigment to drying edges (edge darkening).
- Granulation lets pigment settle into paper valleys.

Display shader converts absorption → visible color: `paintColor = 1.0 - dye`.

Color mixing uses **mixbox** latent space (7-dim) for subtractive pigment mixing.
Wells store per-pixel latent buffers; brush picks up mixed color on contact.

### Known palette issues / debugging

- **Float texture filtering** — mobile GPUs (e.g. iPhone) often lack
  `OES_texture_float_linear`. Without it, `texture2D()` returns `(0,0,0,0)` when
  sampling FLOAT textures with `GL_LINEAR`. Fix: detect extension and use
  `GL_NEAREST` when float linear is unavailable. Debug log shows
  `FloatLinear:false`.
- **Absorption values must stay < 1.0** per channel. The splat shader adds
  `(1 - rgb/255) * strength` to the dye. Keep strength ≤ 0.5.
- Debug log (bottom-right overlay) watches for `LINK ERR`, `GL ERR`,
  `SHADER ERR`. `Frame1 OK` confirms pipeline.

Mobile (iPhone) layout: `@media (max-width: 600px)` stacks palette on top,
canvas below. Only 2 mixing wells (3rd+ hidden). `touch-action: none` on body,
pointer events for painting (works with finger + Apple Pencil).

Development tips:
- Version string bottom-right (`page:palette vX`) — bump on each push to verify
  deployment.
- Paint transfer to wells: `dabOnWell()` — controls opacity, stroke fade, color
  pickup. Loaded brush deposits ~150 dabs empty / ~60 dabs painted before
  transitioning to mixing.

## `chinese/` — Chinese learning app

Pure static HTML/CSS/JS. Loads `hanzi-writer` via jsDelivr CDN; stroke SVG data
is auto-fetched by hanzi-writer from `hanzi-writer-data` on CDN (not bundled).

Data pipeline (one-shot):
1. `npm i -D chinese-lexicon`
2. `node scripts/extract-chinese.mjs` → writes `chinese/data.json`.
3. The resulting JSON is committed so the runtime needs no Node/npm.

Data shape (see `chinese/data.json`): an array of `words` for the seed list and
a `chars` map with etymology + components for every char in those words AND all
their components (BFS closure, one level is usually enough). Component `type`
is one of `iconic | meaning | sound | simplified | deleted | unknown` — these
drive the role-color CSS variables (`--role-*`).

Runtime (`chinese/app.js`):
- Renders a card grid from `data.words`.
- Clicking a card pushes a **modal stack** entry (via `history.pushState`, so
  the browser Back button pops it). For multi-char words, stacks a
  `.char-section` per character.
- Components are clickable buttons that push a char-level detail onto the stack,
  building "mental connections" across characters.
- "Also appears in" chips cross-link between seed words that share chars or
  components.
- Per-char "My story" textarea persists to `localStorage` under
  `chinese.mnemonic.<char>`.

### Adding new words

1. Edit `SEED_WORDS` in `scripts/extract-chinese.mjs`.
2. Run `node scripts/extract-chinese.mjs`.
3. Commit `chinese/data.json`.

## GitHub Pages deployment

- Workflow: `.github/workflows/pages.yml`.
- Copies `index.html`, `palette/*`, `chinese/*` into `_site/`.
- Palette is served at `/palette/`, Chinese at `/chinese/`, landing at `/`.
- **Environment protection rules** on the `github-pages` environment must allow
  the current default branch. If deployment shows success but the site doesn't
  update, check Actions → deploy job for "environment protection rules"
  rejection.

## Development tips

- Bump version strings (`page-id` at bottom-right of each page) when pushing to
  verify the right build is live.
- When working on the Chinese app, you can open `chinese/index.html` directly
  with `python3 -m http.server` from the repo root and browse `/chinese/`.
- When moving files around, remember the Pages workflow's hard-coded `cp` list —
  it must be updated for any new top-level assets.
