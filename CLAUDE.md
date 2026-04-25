# Repo Development Guide

Two web apps deployed together via GitHub Pages:

- **Chinese** (root) — React + TypeScript + Vite app at `/`, the index. Character
  learning with decomposition tree, stroke animations, etymology, saved words.
- **Palette** (`palette/`) — Watercolor painting app, single-file static HTML at
  `/palette/`. Untouched by the Chinese rewrite.

## File structure

```
/
├── index.html                       Vite root entry, drives <App />
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── components/                  SearchBar, HomeGrid, SavedShelf, ResultsList,
│   │                                TreeModal, DecompositionTree, NodeCard,
│   │                                CharPopup, Card
│   ├── hooks/                       useDictionary, useChars, useSaved,
│   │                                useStrokeData, useModalStack
│   └── lib/                         types, pinyin, search, tree
├── public/
│   ├── data.json                    full word list (deleted in Phase 2 → Supabase)
│   ├── data-chars.json              char etymology map (stays static)
│   └── favicon.svg
├── palette/                         (unchanged: HTML/CSS/JS watercolor app)
├── scripts/
│   └── extract-chinese.mjs          chinese-lexicon → public/data*.json
├── package.json                     react + react-dom + d3, no router
├── vite.config.ts
├── tsconfig.json
└── .github/workflows/pages.yml      builds Vite, copies palette/, deploys
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

## Chinese app — root

React + TypeScript single-page app, built with Vite. Loads `hanzi-writer` via
jsDelivr CDN (declared in `index.html`); stroke SVG data is auto-fetched by
hanzi-writer from `hanzi-writer-data` on CDN.

Data pipeline (one-shot, run when chinese-lexicon updates):
1. `npm install`
2. `node scripts/extract-chinese.mjs` → writes `public/data.json` and
   `public/data-chars.json`.
3. The resulting JSONs are committed; runtime fetches them from `/data.json`
   and `/data-chars.json`.

Data shapes:
- `data.json`: `{ words: [{word, pinyin, searchablePinyin, definitions, hsk, rank, trad?}, …] }`
  — full chinese-lexicon (~91k words). Hydrated client-side: `simp = word`,
  `chars = [...word]`.
- `data-chars.json`: `{ chars: { [char]: { pinyin, definitions, originalMeaning,
  notes, components: [{char, type, fragment, …}], hasEtymology } } }`
  — ~10k chars; etymology + component fragments for the decomposition tree.

Component `type` is one of `iconic | meaning | sound | simplified | deleted |
unknown` — drives the role-color CSS variables (`--role-*`).

Runtime architecture (`src/`):
- `App.tsx` orchestrates everything (search debounce, modal stack, popup).
- `useDictionary` fetches `data.json`, hydrates, builds `Map<word, entry>`.
- `useChars` fetches `data-chars.json`.
- `useSaved` owns the saved-words `Set<string>`, persisted to `localStorage`
  under key `chinese.saved`. Includes Export-to-JSON for backup.
- `useModalStack` integrates with `history.pushState` so the browser Back
  button pops modal layers.
- `useStrokeData` is a per-session cache around `HanziWriter.loadCharacterData`.
- `DecompositionTree` mounts d3-hierarchy + d3-zoom on an SVG ref; node cards
  are React components rendered into `<foreignObject>` slots positioned by
  d3 layout. Pinch / scroll zoom past 1.7× expands cards (via dynamic
  `foreignObject height`) to reveal etymology text.
- `CharPopup` opens on tree-node tap: stroke animation, full definitions,
  star toggle, chips of saved words containing this character.

### Adding new words

The seed is now the entire chinese-lexicon (~91k words filtered: CJK only,
length ≤ 8, not a proper noun, not just a cross-reference). To regenerate
after a chinese-lexicon update:
1. `npm install` (picks up new chinese-lexicon version).
2. `node scripts/extract-chinese.mjs`.
3. Commit `public/data.json` and `public/data-chars.json`.

## GitHub Pages deployment

- Workflow: `.github/workflows/pages.yml`.
- Runs `npm ci && npm run build`, copies `dist/` to `_site/`, then copies
  `palette/*` into `_site/palette/`.
- Chinese app served at `/`, palette at `/palette/`.
- **Environment protection rules** on the `github-pages` environment must allow
  the current default branch. If deployment shows success but the site doesn't
  update, check Actions → deploy job for "environment protection rules"
  rejection.

## Development tips

- `npm run dev` for a Vite dev server with HMR.
- `npm run build` produces `dist/`; `npm run preview` serves it locally.
- Bump the `chinese vX` version string near the bottom of `App.tsx` when
  pushing, so you can verify the right build is live.
