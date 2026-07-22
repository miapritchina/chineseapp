# Chinese-character learning app

Mobile-first web app for learning Chinese characters — search,
decomposition tree, four-tier status model, FSRS-scheduled review.
Live at https://decobots.github.io/chineseapp/.

One React app: search, saved-words shelf, SRS review drills, the
Explore browser (words ↔ characters ↔ components), a 三字经 reader,
and a sentence composer.

## Stack

- React + TypeScript + Vite for the main UI
- Supabase (Postgres + RLS) for dictionary + user-private state
- `ts-fsrs` for spaced-repetition scheduling
- `hanzi-writer` (CDN) for stroke animation + production drills

## Quick start

```bash
npm ci
npm run dev      # Vite dev server with HMR
npm run build    # writes dist/
npm test         # ~105 headless cases across scripts/test-*.mjs
```

## Documentation

The project's documentation lives in two places:

- **`CLAUDE.md`** (repo root) — file-tree reference and the working
  agreement for Claude Code (workflow, communication, doc-sync rules).
  Read this first if you're picking up the project.
- **[`docs/`](docs/INDEX.md)** — everything else, organized:
  - [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) — how the app is shaped
  - [`docs/decisions/`](docs/decisions/INDEX.md) — ADRs (the *why* for specific calls)
  - [`docs/design-system/`](docs/design-system/INDEX.md) — tokens, type scale, component inventory
  - [`docs/product/`](docs/product/INDEX.md) — UX redesign spec, QA findings, card-type catalog
  - [`docs/archive/`](docs/INDEX.md) — historical handoff prompts

## Deployment

Pushing to `claude/main` (default branch) triggers
`.github/workflows/pages.yml`. It builds Vite + Storybook and
publishes to GitHub Pages. Supabase
migrations apply automatically on pushes that touch
`supabase/migrations/**`.

## License

Unspecified.
