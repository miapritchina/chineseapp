# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Version tags
correspond to the `chinese vNN` label shown at the bottom of the
hamburger menu — bumped on every push to main.

Categories: **Added** · **Changed** · **Fixed** · **Deprecated** · **Removed** · **Security**

---

## [Unreleased]

### Added
- Vitest + React Testing Library alongside the existing `scripts/test-*.mjs` suite. New scripts: `test:unit`, `test:watch`, `typecheck`, `lint`, `format`.
- ESLint (flat config) + Prettier + Husky pre-commit (lint-staged + `npm test`).
- `src/lib/localCache.ts` — generic localStorage map primitives (timestamp / object / versioned). 12 unit tests.
- `src/hooks/useReconcileTriggers.ts` — reconcile-on-sign-in + reconcile-on-focus (throttled), used by `useSaved`/`useMnemonics`/`useReview`. 6 unit tests.
- `src/lib/withErrorLog.ts` — Supabase `{data, error}` wrapper (`withErrorLog`, `logAndForget`).
- `ItemKind`, `Facet`, `GradeEvent`, `GradeHandler` types in `src/lib/types.ts`.
- `zustand` dependency (for the upcoming state-store refactor).
- `docs/` tree with INDEX files: `architecture/`, `decisions/`, `design-system/`, `product/`, `archive/`.
- Nine ADRs under `docs/decisions/` (Supabase-source-of-truth, FSRS short-term-off, 4-tier status model, cascade-on-Good-not-Again, additive migrations, daily cap + leech interleave, tap-anywhere-to-advance, functional setState pattern, chars-static-words-in-DB).
- `docs/product/` with the May 12 2026 UX redesign spec, the v84 QA fix prompt, the card-type catalog, and the full QA report PDF.
- `TODO.md`, `BUGS.md`, `CHANGELOG.md` at repo root — living trackers, updated in the same commit as the work.
- CLAUDE.md sections for **doc-review-before-push** and **tracker maintenance**.

### Changed
- `useSaved`, `useMnemonics`, `useReview` now share `useReconcileTriggers` and localCache primitives instead of each re-implementing them. ~120 lines of duplicated cloud-sync skeleton removed.
- Documentation reorganized: `DESIGN.md` → `docs/architecture/ARCHITECTURE.md` (trimmed; rationale lives in ADRs).
- `CLAUDE.md` rewritten as a working agreement: project context, dev rules, doc rules, communication preferences, quick reference.
- `README.md` replaced (the prior content described an unrelated "RIPsV Editor" project).
- `design-system/` → `docs/design-system/` (DESIGN-SYSTEM.md, design-tokens.css, style-guide.html).
- Framing corrected throughout: this is **one app with three surfaces** (main React UI + two Cytoscape views), not three separate apps. Updated CLAUDE.md, ARCHITECTURE.md, README.md, ADR-0009.

### Removed
- `palette/` watercolor app — unrelated to the Chinese app; source delivered out-of-band as a zip.
- `design-system/style-report-slavic-deck.html` — unrelated project's style report.

### Notes
- No app-behavior changes in this release. Documentation + foundation for the multi-stage refactor (cloud-sync extraction → contexts/zustand → App.tsx split → drill-card shell → EntitySheet split → CSS reorg).

---

## [v90] — pre-existing baseline

Initial entry. Pre-v90 history is not back-filled; see git log for
detail. From here forward, every push to main appends to this file.
