# Artist Palette — Development Guide

## Project Overview
A browser-based watercolor painting app with realistic paint mixing using **mixbox.js** (pigment-based color mixing in latent space). Deployed via GitHub Pages.

## Architecture

### Single-file app: `palette.html`
- **CSS** (lines 1-265): Responsive layout — desktop (sidebar + canvas) and mobile (stacked)
- **HTML** (lines 267-301): App shell with color swatches, wells, water jar, canvas
- **JavaScript** (lines 303-1540): All logic in an IIFE

### Key Components
1. **Color Palette** — 12 pigment colors as swatches with dry-paint texture rendering
2. **Mixing Wells** — 2D canvas with per-pixel latent-space color mixing via mixbox
3. **Drawing Canvas** — WebGL fluid simulation for watercolor physics
4. **Water Jar** — Tap to dilute brush, hold to clean

### WebGL Watercolor Engine (`FluidSim` class)
The main canvas uses a full fluid dynamics simulation:
- **Velocity field** — advected Navier-Stokes with pressure solve (20 Jacobi iterations)
- **Dye field** — stores pigment absorption values (not RGB directly)
- **Wetness field** — tracks water on paper, dries from edges inward
- **Paper texture** — procedural noise for dry-brush and granulation effects
- **Capillary flow** — pigment migrates toward drying edges (edge darkening)
- **Granulation** — pigment settles into paper valleys during drying

Display shader converts absorption → visible color: `paintColor = 1.0 - dye`

### Color Mixing
Uses **mixbox** latent space (7-dimensional) for physically accurate pigment mixing.
- `mixbox.rgbToLatent()` / `mixbox.latentToRgb()` for conversion
- Wells store per-pixel latent buffers for true subtractive mixing
- Brush picks up mixed color from wells on contact

## Known Issues & Debugging

### Canvas appears dark / no paint visible
- **CRITICAL: Float texture filtering** — Mobile GPUs (e.g. iPhone) often lack `OES_texture_float_linear`. Without it, `texture2D()` returns `(0,0,0,0)` when sampling FLOAT textures with `GL_LINEAR` filter. The fix: detect the extension and use `GL_NEAREST` when float linear is unavailable. Debug log shows `FloatLinear:false` when this applies.
- **Absorption values must stay < 1.0** per channel. The splat shader adds `(1 - rgb/255) * strength` to the dye. Keep strength ≤ 0.5 for watercolor look.
- Check debug log (bottom-right overlay) for: `LINK ERR`, `GL ERR`, `SHADER ERR`
- `Frame1 OK` confirms WebGL rendering pipeline is working

### GitHub Pages Deployment
- Workflow: `.github/workflows/pages.yml`
- Copies `palette.html` → `_site/index.html`, plus `mixbox.js`
- **Environment protection rules** on the `github-pages` environment must allow the current default branch
- Default branch: `claude/pull-latest-changes-CgInh`
- If deployment shows success but site doesn't update, check Actions → deploy job for "environment protection rules" rejection

### Mobile (iPhone) Layout
- `@media (max-width: 600px)`: Single column, palette on top, canvas below
- Only 2 mixing wells shown (3rd+ hidden via CSS `display: none`)
- Touch events: `touch-action: none` on body, `preventDefault` on touchstart/move/end
- Pointer events used for actual painting (works with both finger and Apple Pencil)

## File Structure
```
palette.html    — Main app (single file, self-contained except mixbox)
mixbox.js       — Mixbox pigment mixing library (external dependency)
index.html      — Redirect to palette.html (also used as debug page in deploy)
.github/workflows/pages.yml — GitHub Pages deployment workflow
```

## Development Tips
- Version string at bottom-right of page (`page:palette vX`) — update on each push to verify deployment
- Debug log overlay shows WebGL init status and first 3 splat coordinates
- Wells use 2D Canvas API; main canvas uses WebGL — different rendering pipelines
- Paint transfer to wells: `dabOnWell()` — controls opacity, stroke fade, and color pickup
- Well stroke behavior: loaded brush deposits paint for ~150 dabs on empty areas, ~60 on painted areas, then gradually transitions to mixing
