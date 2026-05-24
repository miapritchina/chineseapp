# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Version tags
correspond to the `chinese vNN` label shown at the bottom of the
hamburger menu — bumped on every push to main.

Categories: **Added** · **Changed** · **Fixed** · **Deprecated** · **Removed** · **Security**

---

## [Unreleased]

*Next change lands here.*

## [v93]

### Added
- `<Entity hanziSlot>` prop — opt-in escape hatch that replaces Entity's default key-as-text content inside `.entity-hanzi`. Lets callers (e.g. a future M3 sheet-header migration) embed `<HanziGlyph mode="animate">` inside Entity's pinyin → hanzi → meaning DNA without losing stroke animation. Unused so far.

### Changed
- **EntitySheet split (refactor stage E):** 417 → 214 lines. Four content blocks pulled into focused sub-components under `src/components/sheet/`:
  - `SheetHeader.tsx` — eyebrow + glyph (HanziGlyph stroke-anim for single chars; plain + 🔊 for multi-char words) + POS · defs row.
  - `EtymologySection.tsx` — "Nº NN · ETYMOLOGY / MADE OF" + role-colored decomposition equation + etym note.
  - `RelatedSection.tsx` — "Nº NN · CHARACTERS / IN YOUR SAVED WORDS" list; resolves chars + word lookups from context.
  - `MnemonicSection.tsx` — "Nº NN · 💡 MAKE IT STICK" with the edit/reset/persist lifecycle (extracted `MnemonicEditor`-equivalent).
  - `helpers.ts` — `commonnessLabel` + `roleColor` (were inline in EntitySheet).

  EntitySheet.tsx is now the shell: identity resolution, drag-to-dismiss, Escape handler, status corner, section numbering, and slots in the four sub-components. Browser-verified — multi-char + single-char sheets render identically to v92 (stroke animation, etym role colors, related rows, mnemonic editor all work).

## [v92]

### Changed
- **`<Entity>` component wired into 7 call sites** (refactor stages C + D, browser-verified per migration):
  - M1 saved-shelf card → `<Entity size="md">` (deletes `Card.tsx` / `CharOnlyCard`).
  - M10 ComponentTable chip → `<Entity size="tiny" showPinyin>` with count via `trailing`.
  - M7 SentenceStudio bank chip → `<Entity size="sm">` with `roleColor={POS_COLOR[pos]}`.
  - M8 SentenceStudio composer token → `<Entity size="tiny" showPinyin>` with POS color border.
  - M13 ClusterRecall cell → `<Entity size="sm">` with reveal-state disclosure (hidden = hanzi only; revealed = pinyin + meaning + accent border).
  - M14 DisambiguationCard cell → `<Entity size="sm">` with `var(--accent)` border on the focus cell.
  - M11 CombinedRecognitionCard's focal `.review-hanzi` → `<Entity size="hero">` (white-bg card, 120px hero hanzi).
  - M12 PhoneticTapCard hanzi picks → `<Entity size="tiny">` with `.is-correct` / `.is-wrong` / `.is-reveal` flash modifiers (CSS added).
- `EntitySheet` glyph + ProductionCard tracer already consume `<HanziGlyph>` from stage B; no new sheet-header migration (M3 → P4 is deferred — would lose HanziWriter stroke animation; needs owner sign-off).
- FamilyTransferCard + ComponentSoundCard pick buttons stay as-is — their choices are pinyin syllables, not entities.

### Removed
- `src/components/Card.tsx` (and `CharOnlyCard`) — fully replaced by Entity md in `SavedShelf`.

### Notes
- All migrations browser-verified at `http://localhost:5173/chineseapp/` via Chrome DevTools MCP (clicks, taps, navigation snapshots). Zero console errors after each commit.

## [v91]

### Added
- Shared UI primitives in `src/components/ui/`: `PageHeader`, `EmptyState`, `Eyebrow`, `SectionHeader`, `SpeakButton` — drop-ins emitting the existing classes. Adopted by `ReviewPage`, `ClusterRecall`, `PhoneticsPage`, `ResultsList` (refactor stage A). 8 component tests; RTL auto-cleanup wired in `vitest.setup.ts`.
- Drill chrome components (refactor stage B): `DrillShell` (replaces ReviewPage's inline `DrillFrame`), `GradeButtons` (the Again/Good/Easy trio, used by `CombinedRecognitionCard` + `ClusterRecall`), `HanziGlyph` (unifies the HanziWriter animate-mode mount in `EntitySheet` and trace-quiz mount in `ProductionCard`). 8 component tests incl. a mocked HanziWriter global.
- `src/components/Entity.tsx` — unified character/word tile (redesign §0), sizes tiny/sm/md/lg/hero with shared visual DNA (pinyin → hanzi → meaning + POS, status corner at md+), role-color border via `--entity-role`, context-resolved data. `.entity` CSS in `styles.css` (refactor stage C scaffolding). 7 component tests. **Not yet wired into any call site** — the M→P migrations change pixels and need a browser pass.
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
- Prop-drilling pyramid replaced with contexts. `Card`, `ResultsList`, `SavedShelf`, `PhoneticsPage`, `TreeModal`, `EntitySheet`, `SentenceStudio`, `ClusterRecall`, `ReviewPage` now consume `useSavedCtx` / `useDictCtx` / `useCharsCtx` / `useMnemonicsCtx` directly. App.tsx no longer threads `saved` / `findWord` / `chars` / `getStatus` / `setStatus` through children.
- `App.tsx` UI state migrated to `useUIStore` (Zustand): `query` / `debouncedQuery` / `searchMode` / `searching` / page flags / sign-in modal. Modal stack stays in `useModalStack` (owns `history.pushState`).
- Auto-import effects extracted to `src/hooks/useAutoImport.ts` (handles `?import=` / `?share=` / `?clear=1`). App.tsx down from ~620 → ~420 lines.
- Documentation reorganized: `DESIGN.md` → `docs/architecture/ARCHITECTURE.md` (trimmed; rationale lives in ADRs).
- `CLAUDE.md` rewritten as a working agreement: project context, dev rules, doc rules, communication preferences, quick reference.
- `README.md` replaced (the prior content described an unrelated "RIPsV Editor" project).
- `design-system/` → `docs/design-system/` (DESIGN-SYSTEM.md, design-tokens.css, style-guide.html).
- Framing corrected throughout: this is **one app with three surfaces** (main React UI + two Cytoscape views), not three separate apps. Updated CLAUDE.md, ARCHITECTURE.md, README.md, ADR-0009.
- Docs reconciled with the shipped v90 UX pass: redesign spec now has a **Shipped (as of v90)** section; `DESIGN-SYSTEM.md` / `design-tokens.css` / `style-guide.html` add `--surface` + `--grade-hard` and the canonical type-scale tokens, and drop the resolved `--surface`-undefined / role-hex-duplication notes; `ARCHITECTURE.md` drops the stale "localStorage for now" framing. `BUG-3` and `BUG-5` moved to Fixed (code-verified); `BUG-1` annotated as wired-pending-live-check. `TODO.md` reframed around the `<Entity>` + shared-component plan.

### Removed
- `palette/` watercolor app — unrelated to the Chinese app; source delivered out-of-band as a zip.
- `design-system/style-report-slavic-deck.html` — unrelated project's style report.

### Notes
- No app-behavior changes in this release. Documentation + foundation for the multi-stage refactor (cloud-sync extraction → contexts/zustand → App.tsx split → drill-card shell → EntitySheet split → CSS reorg).

---

## [v90] — pre-existing baseline

Initial entry. Pre-v90 history is not back-filled; see git log for
detail. From here forward, every push to main appends to this file.
