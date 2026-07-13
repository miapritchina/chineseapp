# Design system

Reference for tokens, type scale, and the component inventory. **Not
built or served by the app** — these files exist for designers and as
documentation. The authoritative copy of every token still lives in
`src/styles.css`.

## Files

- **Storybook** (`npm run storybook`, deployed at
  `/chineseapp/storybook/`) — the *living* component documentation:
  real components rendered against fixture data, prop tables generated
  from TypeScript (autodocs), and a token gallery that reads the
  shipped `src/styles.css` custom properties at runtime, so it cannot
  drift. Stories live next to their components (`src/**/*.stories.tsx`);
  shared fixtures + provider decorator in `.storybook/`.
- **[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md)** — full system reference.
  Colors, typography + type scale, spacing/radii/shadows/breakpoints/
  z-index, motion, layout patterns, component inventory, and
  componentization proposals. Imports cleanly into Claude Design.
- **[`design-tokens.css`](design-tokens.css)** — standalone `:root`
  token file (colors, `--pos-*`, `--role-*`, type scale, spacing, radii,
  shadows, z-index) mirroring `src/styles.css`. Some tokens are
  *normalized/aspirational* — they promote values the code still
  inlines (status hues, grade colors, the type scale) to named tokens.
- **[`style-guide.html`](style-guide.html)** — dependency-free living
  style guide. Open it in a browser; it isn't built or served.

## Sync rule

Where `design-tokens.css` and `src/styles.css` disagree, **`src/styles.css`
is authoritative for what ships**. When you change `:root` tokens in
`src/styles.css`, the color constants in `src/lib/pos.ts`, the
role-color mapping, the breakpoints, or add a reusable component/hook,
update this folder **in the same commit**.

If `design-tokens.css` ever becomes the single source of truth, have
`src/styles.css` `@import` it (or generate one from the other) — not
done yet.
