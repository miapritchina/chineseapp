# Working with this repo

This is the working agreement between the owner and Claude Code on
this project. It covers **what the project is**, **how to navigate
it**, **how to work in it** (development + documentation rules), and
**how to communicate** while doing so.

For deeper context:
- Architecture, data flow, drill contracts: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)
- Specific decisions and rationales: [`docs/decisions/INDEX.md`](docs/decisions/INDEX.md)
- Design system reference: [`docs/design-system/INDEX.md`](docs/design-system/INDEX.md)
- In-flight UX / product specs: [`docs/product/INDEX.md`](docs/product/INDEX.md)

---

## 1. What the project is

One Chinese-character learning web app, deployed to GitHub Pages at
https://miapritchina.github.io/chineseapp/. Mobile-first; iPhone Safari in
3–7 minute sessions. Installable PWA (v96) — see ARCHITECTURE.md →
"PWA / offline".

**One React surface** since v109: search, saved-words shelf,
decomposition tree, SRS review drills, the 三字经 reader, Sentence
Studio, and the Explore page (focus-stack browsing of words ↔
characters ↔ components — replaced the old Cytoscape network/
components graph pages and the Phonetics list; see
docs/product/explore-page.md).

### Data persistence policy (do not weaken)

**Supabase is the source of truth for every piece of user data** —
saved words, statuses, FSRS state, mnemonics, sentences (composer
draft + saved sentences). `localStorage` is permitted **only as an
offline read-cache**, never authoritative. Public derivable data
(dictionary rows, `data-chars.json`, stroke data, the per-day new-card
counter) may stay cached locally.

**Every new user-data feature ships with a Supabase table + RLS + sync
from day one.** Do not merge a feature whose state lives only in
`localStorage`. Migrations are additive only — see [ADR-0001](docs/decisions/0001-supabase-source-of-truth.md)
and [ADR-0005](docs/decisions/0005-additive-migrations-and-shape-fallback.md).

---

## 2. File structure

```
/
├── README.md                        Public-facing readme
├── CLAUDE.md                        This file
├── docs/                            All other documentation — see docs/INDEX.md
│   ├── architecture/ARCHITECTURE.md How the app is shaped
│   ├── decisions/                   ADRs — one decision per file
│   ├── design-system/               Tokens, type scale, style guide (reference, not built)
│   ├── product/                     UX redesign spec, QA findings, card-type catalog
│   └── archive/                     Historical one-shot prompts
├── index.html                       Vite root entry, drives <App />
├── .storybook/                      Storybook config + fixture providers
├── src/
│   ├── main.tsx                     ErrorBoundary + on-page diag overlay
│   ├── App.tsx                      Orchestrates everything
│   ├── styles.css                   Authoritative for all tokens that ship
│   ├── components/
│   │   ├── SearchBar                Two modes: Dictionary / By component
│   │   ├── ResultsList              Search results
│   │   ├── SavedShelf               Home grid w/ status sections + sort pills
│   │   ├── ComponentTable           Empty-state for By-component search
│   │   ├── Card / NodeCard          Shared word + tree-node cards
│   │   ├── TreeModal                Full recursive decomposition tree (d3) — view: "tree"
│   │   ├── DecompositionTree        d3-hierarchy + d3-zoom + foreignObject cards
│   │   ├── EntitySheet              Unified word/char/component sheet — view: "sheet"
│   │   ├── HamburgerMenu            Top-bar drawer (Review / Phonetics / Network …)
│   │   ├── StatusButton             4-tier status dropdown shared by every place
│   │   ├── ReviewPage               Full-screen SRS surface, routes by facet
│   │   ├── ClusterRecallCard        Drill: recall a group of related saved words
│   │   ├── SiftPage                 Tinder-style triage over the due backlog
│   │   ├── StatsPage                Words/strength/review-history stats (#/stats)
│   │   ├── LearnPage                Lesson cards that teach instead of test
│   │   ├── ProductionCard           Drill: Hanzi Writer trace quiz
│   │   ├── DisambiguationCard       Leech-cluster side-by-side compare
│   │   ├── ExplorePage              Words ↔ chars ↔ components browser (v109)
│   │   ├── ClassicPage              三字经 reader w/ known-char highlighting
│   │   ├── SentenceStudio           Build-a-sentence composer + POS bank
│   │   ├── AuthButton + SignInModal Email one-time-code auth
│   ├── hooks/                       Cloud-first hooks; see ARCHITECTURE.md "Cloud-first + local cache pattern"
│   │   ├── useDictionary            Supabase RPC + cache for word lookups
│   │   ├── useChars                 Fetches public/data-chars.json
│   │   ├── useSaved                 4-status localStorage + Supabase mirror
│   │   ├── useReview                ts-fsrs scheduler at word/char/component level
│   │   ├── usePhoneticComponents    Fetches public/phonetic-components.json
│   │   ├── useMnemonics             Per-word/char user notes
│   │   ├── useSentenceDraft         Composer draft → user_sentence_draft
│   │   ├── useSavedSentences        Saved sentences → user_sentences
│   │   ├── useStrokeData            Per-session HanziWriter cache
│   │   ├── useModalStack            history.pushState integration for modal stack
│   │   └── useAuth                  supabase.auth wrapper
│   └── lib/
│       ├── types.ts                 Word, Char, Component, Role, Status…
│       ├── pinyin.ts                Tone-stripping
│       ├── pos.ts                   POS heuristic for Sentence Studio
│       ├── search.ts                Client-side ranking (legacy)
│       ├── speech.ts                Web Speech API helper
│       ├── tree.ts                  buildCharTree, strokeRoleForIndex
│       ├── componentSearch.mjs+.d.ts Recursive-closure search + freq map
│       ├── confusionClusters.mjs+.d.ts Hand-curated leech clusters
│       ├── fsrs.ts                  ts-fsrs wrapper + cascade math
│       ├── flow.ts                  "Just start" stage planner (sift → review → learn)
│       ├── sift.ts                  Sift triage pool (due words, strongest first)
│       ├── learn.ts                 Learn-mode material picker
│       ├── share.ts                 profile share links (?share=token → live saved set)
│       └── supabase.ts              Client + wakeUp ping
├── public/
│   ├── data-chars.json              ~10k chars + components + etymology
│   ├── phonetic-components.json     Top-250 productive sound components
│   ├── sanzijing.json               三字经 (1068 chars) + Giles translation
│   ├── favicon.svg                  中 glyph (drawn as shapes)
│   └── pwa-*.png, apple-touch-icon.png, maskable-icon-*.png
├── scripts/
│   ├── extract-chinese.mjs          chinese-lexicon → public/data*.json
│   ├── extract-phonetic-components.mjs Ranks sound components, dumps JSON
│   ├── seed-supabase.mjs            Bulk-loads ~91k words via service role
│   └── test-*.mjs                   Eleven headless test files (npm test)
├── supabase/
│   └── migrations/                  Idempotent additive migrations
├── package.json                     react, d3, ts-fsrs, supabase-js, lz-string
├── vite.config.ts                   base path + vite-plugin-pwa (manifest, SW, caches)
├── tsconfig.json
└── .github/workflows/pages.yml      Builds Vite + Storybook, publishes to Pages
```

---

## 3. Development rules

These are hard rules. Bend them only after asking.

### Tests

- **`npm test` must pass before every commit.** ~105 cases, headless,
  fast.
- **`npm test` must pass before any PR is opened or updated.**
- **All tests should always pass on main.** If they don't, fix
  before doing anything else.
- **Add or update tests when you change behavior.** New seed rule,
  new drill, new persisted field, schedule change — write the test
  alongside.

### Git + PR flow

- Branch off `claude/main`. Current working branch is set by the
  harness.
- **Pull `origin/claude/main` before opening a PR.** Rebase locally
  rather than letting GitHub merge unless told otherwise.
- **Never push to `main` directly.** Never force-push to it.
- Don't use `--no-verify`, `--no-gpg-sign`, or amend a pushed commit
  unless explicitly asked.
- **Never create a PR unless explicitly asked.** The owner opens PRs
  from the Claude Code UI.

### Review documentation before pushing

Before every push to a branch that has an open PR (or before merging
to main):

1. **Re-read the docs you touched.** Skim them as if you'd never seen
   the change — do the words still describe what the code does?
2. **Scan adjacent docs.** If you changed feature X, check whether
   ARCHITECTURE.md, the relevant ADR, or CLAUDE.md still match.
3. **Verify TODO.md / BUGS.md / CHANGELOG.md reflect the change.**
   Remove fixed items, add new ones noticed in passing, write the
   changelog entry under `[Unreleased]`.
4. **State the result.** In the reply: "Docs reviewed — X updated, Y
   still accurate, Z needs follow-up." Don't push silently.

### Trackers — keep them current

Three living files at repo root document state, not history:

- **[`CHANGELOG.md`](CHANGELOG.md)** — Keep a Changelog format.
  Append to `[Unreleased]` in the same commit as the change. On
  merge to main, the version bump finalizes `[Unreleased]` into
  `[vNN]` and starts a fresh `[Unreleased]` section.
- **[`TODO.md`](TODO.md)** — P0 / P1 / P2 / P3 / Deferred. Tasks
  move between priorities only when external priority changes. On
  completion, the task is **removed** and added to CHANGELOG.md in
  the same commit.
- **[`BUGS.md`](BUGS.md)** — Open / Fixed / Withdrawn. `BUG-NNN` IDs
  are immutable. Fixed bugs move to the Fixed table; the bug detail
  stays under "Details" for searchability.

**Update them in the same commit as the work.** Bug fixed → move row
to Fixed, remove detail (or trim), add CHANGELOG entry — all one
commit.

**Suggest entries proactively.** Notice a new bug while doing other
work → add it to BUGS.md (lowest severity that fits, owner re-prioritizes
later). Notice a TODO worth tracking → propose it in TODO.md. Don't
hoard observations for "later."

### Version bump (`chinese vNN`)

Every push to `main` (or merge to it) bumps the `chinese vNN` version
label in `App.tsx`'s `<HamburgerMenu />` props — so the owner can
verify from their phone which build is live. This is **every push**,
even backend-only or doc-touching ones. The label shows at the bottom
of the hamburger menu.

If a PR collects multiple commits, the version bump happens once on
the commit that lands.

### Migrations

- Idempotent + additive only. Never drop, never rename. See [ADR-0005](docs/decisions/0005-additive-migrations-and-shape-fallback.md).
- Front-end queries widest shape first, falls back on `column not
  found`.
- Migrations apply themselves: the **Setup Supabase** workflow
  auto-runs on any merge to `claude/main` touching
  `supabase/migrations/**`. After merging a migration PR, verify that
  run succeeded (dispatch it manually if it didn't fire) — never ask
  the owner to run it.

### Code style

- TypeScript everywhere in `src/`. Plain `.mjs` for tests + the
  `componentSearch` / `confusionClusters` libs that tests import
  directly.
- Match existing patterns. The hooks all follow the cloud-first +
  local cache shape — clone it for new ones (ARCHITECTURE.md → "Cloud-
  first + local cache pattern").
- Default to **no comments**. Add a comment only if the WHY is
  non-obvious — a hidden constraint, a subtle invariant, a workaround
  for a specific bug. Don't explain what well-named code already says.
- Don't add features, refactors, or abstractions beyond what the task
  requires. No premature error handling, no fallbacks for impossible
  states, no feature flags unless asked.

---

## 4. Documentation rules

### Sync rule (the one that matters most)

**When you touch a feature, check whether its docs are still accurate
in the same change.** If they are, say so. If they aren't, flag it —
either fix it in the same commit (small drift) or call it out
explicitly for a follow-up (large drift).

Specifically:

- Architecture change → update [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).
- New significant decision → add an ADR in [`docs/decisions/`](docs/decisions/INDEX.md).
- Token / style change in `src/styles.css`, `src/lib/pos.ts`,
  role-color mapping, breakpoints, or a reusable hook/component →
  update [`docs/design-system/`](docs/design-system/INDEX.md) in the same commit.
- UX redesign work implemented → mark the relevant section of
  [`docs/product/chinese-app-ux-redesign.md`](docs/product/chinese-app-ux-redesign.md) as Done or move it to a Shipped
  subheading. Same for [`docs/product/qa-fix-prompt.md`](docs/product/qa-fix-prompt.md).
- New persisted state → update the data table in
  [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

### ADRs

Numbered, immutable, one decision per file. Format:

```markdown
# ADR-NNNN — Short imperative title

**Status:** Proposed | Accepted | Superseded by ADR-XXXX · **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```

Keep them short. If a decision needs more than a screen, split it.

### Don't create files unsolicited

Don't add planning notes, intermediate decision docs, or scratch
files. Work from conversation context. If a doc is genuinely needed
(an ADR for the change you just made, a section in ARCHITECTURE.md),
write it; otherwise skip.

---

## 5. Communication rules

**The owner cares about UI and logic more than implementation
details.** Frame everything that way.

### Before building

- **Understand the why.** When asked to build something, restate the
  goal in your own words (one line) and propose alternatives or
  improvements before implementing. "You want X to do Y — could also
  do it via Z, which would also fix W. Recommend X for [reason]."
- **Ask before large refactors.** Anything beyond a single-file
  surgical change: propose the plan and pause for sign-off.
- **Propose options, not just plans.** When there's a real tradeoff,
  give 2–3 options with the pros/cons each.
- **Stage big refactors.** If a refactor needs more than a few
  commits, propose a stage list. If a new request would disrupt a
  big task in flight, **propose continuing the big task in a new
  chat** so flow isn't lost.

### While building

- Lead with what changed and why; skip narration of small code
  decisions. Don't tell the owner "I'm updating the CSS class" —
  that's noise. Tell them what *behavior* changed.
- **Flag stale docs proactively.** When you touch feature X, scan
  the relevant doc and either update it in the same commit or call
  out the drift in your reply.
- **Don't over-explain successful commands.** Owner reads the PR
  diff; one or two sentences is enough.

### Tone

- Terse, direct, no narration of internal deliberation.
- Use Github-flavored markdown for structure, sparingly.
- When proposing options: use `AskUserQuestion` so the owner can pick
  inline.
- Confirm before risky actions: destructive operations (rm, reset
  --hard, force push, drop column), actions visible to others (PR
  comments, pushes), actions affecting shared infra.

### What NOT to do

- Don't write multi-paragraph docstrings or comment blocks for
  obvious code.
- Don't say "Based on your feedback…" or "Per your request…" —
  just do the thing.
- Don't add summaries describing what well-named identifiers already
  show.
- Don't ship backwards-compat shims, `_unused` renames, or "removed"
  comments. If something's unused, delete it.

---

## 6. Quick reference

| Need | Where |
|---|---|
| How the app is shaped | [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) |
| Why a specific call was made | [`docs/decisions/INDEX.md`](docs/decisions/INDEX.md) |
| Add a new drill type | ARCHITECTURE.md → "Patterns to reuse" |
| Add a new persisted field | ARCHITECTURE.md → "Patterns to reuse" |
| Tokens / type scale / component inventory | [`docs/design-system/DESIGN-SYSTEM.md`](docs/design-system/DESIGN-SYSTEM.md) |
| Living component docs (autodocs + token gallery) | `npm run storybook` (deployed at `/chineseapp/storybook/`) |
| Current UX redesign goals | [`docs/product/chinese-app-ux-redesign.md`](docs/product/chinese-app-ux-redesign.md) |
| Outstanding bugs | [`BUGS.md`](BUGS.md) |
| Active TODO list | [`TODO.md`](TODO.md) |
| Release history | [`CHANGELOG.md`](CHANGELOG.md) |
| UX redesign source spec | [`docs/product/qa-fix-prompt.md`](docs/product/qa-fix-prompt.md) |
| Visual card-type catalog | [`docs/product/card-type-catalog.html`](docs/product/card-type-catalog.html) (open in a browser) |
| Run tests | `npm test` |
| Dev server | `npm run dev` |
| What's the current version | `App.tsx` → `<HamburgerMenu version="chinese vNN" />` |
| Migration policy | [ADR-0005](docs/decisions/0005-additive-migrations-and-shape-fallback.md) |
| User-data persistence policy | [ADR-0001](docs/decisions/0001-supabase-source-of-truth.md) |
