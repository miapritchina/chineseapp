# Docs

Navigation for everything in `docs/`. For project-level instructions
to Claude (workflow, preferences, file-tree), see `CLAUDE.md` at the
repo root.

## Architecture

- [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) —
  How the app is shaped: data layer, status model, SRS layer, surface
  architecture, routing, drill contract, performance notes, things to
  avoid, open work. The **why** for the running system.

## Decisions (ADRs)

Numbered architecture decision records. Each captures the context, the
choice, and the consequences for one specific call.

- [`decisions/INDEX.md`](decisions/INDEX.md)
- [0001 — Supabase is the source of truth for user data](decisions/0001-supabase-source-of-truth.md)
- [0002 — Disable FSRS short-term learning steps](decisions/0002-fsrs-short-term-steps-disabled.md)
- [0003 — Four-status tier model with per-tier timestamps](decisions/0003-four-status-tier-model.md)
- [0004 — Cascade FSRS credit on Good/Easy only, not Again](decisions/0004-cascade-credit-on-good-not-again.md)
- [0005 — Additive-only migrations; widest-shape-first queries](decisions/0005-additive-migrations-and-shape-fallback.md)
- [0006 — Daily new-card cap (25) + active leech interleaving](decisions/0006-daily-cap-and-leech-interleave.md)
- [0007 — Tap-anywhere-to-advance, no auto-advance timers](decisions/0007-tap-anywhere-to-advance.md)
- [0008 — Functional setState in `useReview` for concurrent grades](decisions/0008-functional-setstate-for-concurrent-grade.md)
- [0009 — Char data static, word data in DB](decisions/0009-chars-static-words-in-db.md)

## Design system

UI reference. Tokens, type scale, component inventory.

- [`design-system/INDEX.md`](design-system/INDEX.md)
- [`design-system/DESIGN-SYSTEM.md`](design-system/DESIGN-SYSTEM.md) — full reference
- [`design-system/design-tokens.css`](design-system/design-tokens.css) — token file
- [`design-system/style-guide.html`](design-system/style-guide.html) — living style guide (open in a browser)

## Product specs

In-flight UX work, QA findings, owner interviews.

- [`product/INDEX.md`](product/INDEX.md) — status of each spec (active vs reference)
- [`product/chinese-app-ux-redesign.md`](product/chinese-app-ux-redesign.md)
- [`product/qa-fix-prompt.md`](product/qa-fix-prompt.md)
- [`product/card-type-catalog.html`](product/card-type-catalog.html)
- `product/Chinese_App_QA_Report.pdf`

## Archive

Historical one-shot prompts used to bootstrap the design system and
QA testing. Kept for reference; not maintained.

- [`archive/HANDOFF-DESIGN-SYSTEM.md`](archive/HANDOFF-DESIGN-SYSTEM.md)
- [`archive/HANDOFF-TEST.md`](archive/HANDOFF-TEST.md)
