# Architecture

How the Chinese-character learning app is shaped: what's running, how
data flows, how the UI is composed. Specific *decisions* live as ADRs
in [`../decisions/`](../decisions/INDEX.md) — this doc links to them
for the **why**.

For developer workflow (commit style, version bumps, test rules), see
`CLAUDE.md` at the repo root.

---

## What ships

**One Chinese-character learning web app**, deployed as static files
to GitHub Pages with one Supabase project behind it. The app surfaces
in three places under `/chineseapp/`:

| Path | Tech | What it does |
|---|---|---|
| `/` | React + TS + Vite | Main UI — search, save, decomposition tree, SRS review |
| `/network/` | Cytoscape.js + plain HTML | Word-graph view of the saved set |
| `/components/` | Cytoscape.js + plain HTML | Vocabulary-structure view (words → chars → components) |

The two Cytoscape views are part of the same app — they share the
saved set (read from the `localStorage` offline cache that the
React hooks keep in sync with Supabase, the source of truth — see
[ADR-0001](../decisions/0001-supabase-source-of-truth.md))
and link back into the main UI. They live outside React for
implementation simplicity, not because they're separate products.
The coupling is one line in `.github/workflows/pages.yml` (a `cp`)
and one link in `App.tsx`'s hamburger menu — rewriting them as React
routes is a future option.

## Constraints that shape everything

- **iPhone Safari**, used in short sessions (3–7 min, multiple per day).
- **No dev tools.** A blank screen is a blocker; diagnostic overlays
  live directly on the page (`src/main.tsx` ErrorBoundary + the inline
  error script in `index.html`).
- **iOS Safari + `<foreignObject>` + `position: absolute`** has a
  long-standing rendering bug. Use flex layouts inside foreignObject.
- **Safari ITP** evicts `localStorage` after 7 days idle — the reason
  Supabase is in this stack at all. See [ADR-0001](../decisions/0001-supabase-source-of-truth.md).
- **Touch ergonomics.** Tap targets ≥ 44 px. Tap-anywhere-to-advance
  on drills, see [ADR-0007](../decisions/0007-tap-anywhere-to-advance.md).

---

## Data layer

### Sources of truth

| Source | What lives there | When it ships |
|---|---|---|
| `public/data-chars.json` | ~10k chars + components + etymology | Static; built via `extract-chinese.mjs` |
| `public/phonetic-components.json` | Top-250 productive sound components | Static; built via `extract-phonetic-components.mjs` |
| Supabase `words` table | ~91k words: pinyin, defs, HSK, rank | Static seed via `seed-supabase.mjs`; queried at runtime |
| Supabase `user_saves`, `user_fsrs_state`, `user_mnemonics`, `user_sentences`, `user_sentence_draft` | User-private state — **the source of truth** | Live; `localStorage` is an offline read-cache only |

The split is deliberate — see [ADR-0009](../decisions/0009-chars-static-words-in-db.md).
The user-data policy is [ADR-0001](../decisions/0001-supabase-source-of-truth.md).

### Cloud-first + local cache pattern

Every persisted user-state hook follows the same shape:

1. `useFoo` hook owns a `Map<key, value>` in React state.
2. On first paint, hydrate from `localStorage` so there's no flash.
3. `reconcile()`: read remote → DB wins on conflict; merge into state;
   refresh the `localStorage` cache; upload any local-only entries.
   Called on sign-in **and** on tab focus (`visibilitychange` /
   `window.focus`), throttled ~20 s by a `lastReconcileAtRef`.
4. Each mutation writes to React state, refreshes the cache, and
   writes through to Supabase fire-and-forget.
5. Network/migration errors are downgraded to warnings — the app keeps
   working off the cache, then reconciles on the next successful pull.

Files: `useSaved.ts`, `useReview.ts`, `useMnemonics.ts`,
`useSentenceDraft.ts`, `useSavedSentences.ts` all follow this. New
persisted state should clone it and ship a DB table from day one — see
[ADR-0001](../decisions/0001-supabase-source-of-truth.md).

### Migration discipline

Idempotent and additive-only. See [ADR-0005](../decisions/0005-additive-migrations-and-shape-fallback.md).
The front-end queries the **widest shape first** and falls back on
`column not found` — a Supabase migration can lag the deployment by
hours and the app degrades silently rather than 500ing.

---

## Status model

Four mutually-exclusive tiers per saved item:

| Tier | Column | Surfaces in review |
|---|---|---|
| ★ Saved | (row presence) | meaning + sound recognition |
| ❗ Need to learn | `review_at` | same |
| 🎓 Learned | `learned_at` | same |
| ✒ Wrote | `wrote_at` | + production (Hanzi Writer trace) |

Priority is `wrote > learned > review > saved`. Why this shape and
not an enum: [ADR-0003](../decisions/0003-four-status-tier-model.md).

---

## SRS layer

### Scheduler

`ts-fsrs` FSRS-6 at retention 0.9, with one non-default knob:
`enable_short_term: false`. See [ADR-0002](../decisions/0002-fsrs-short-term-steps-disabled.md).

### Item kind × facet

Each scheduled "thing" is a tuple `(item_kind, item_key, facet)`. Two
kinds, four facets:

| Kind | Facet | Surface | Seed rule |
|---|---|---|---|
| word | `meaningRecognition` | combined recognition card | every saved word |
| word | `soundRecognition` | combined recognition card (same surface) | every saved word |
| char | `familyTransfer` | "you know 青, what about 情?" multi-choice | up to 2 family members per saved phonetic component, picked from chars the user hasn't saved |
| char | `production` | Hanzi Writer trace quiz | single-char saved items at ✒ Wrote tier |

`recognition` is a legacy facet name from pre-v66 cards; the load path
renames them to `meaningRecognition` in memory. `phoneticTap` and
`componentSound` are retired facets (drills dropped from the launch
screen in v85, seeding + rows removed in v95) — legacy rows are
ignored on load and scrubbed locally.

The combined recognition card grades both `meaningRecognition` and
`soundRecognition` at once but they're two FSRS Cards under the hood
— retention numbers stay distinct per-modality. This is what forced
[ADR-0008](../decisions/0008-functional-setstate-for-concurrent-grade.md)
(since superseded in v95 by a ref-mirrored map — `cardsRef` in
`useReview` — so both same-tick grades also reach the Supabase upsert).

### Cascade

Good/Easy on a word damp-credits every constituent char. Again does
not cascade. See [ADR-0004](../decisions/0004-cascade-credit-on-good-not-again.md).

### Daily cap + leech interleaving

25 new cards/day cap; `lapses ≥ 6` items with cluster entries get
side-by-side disambig. See [ADR-0006](../decisions/0006-daily-cap-and-leech-interleave.md).
Since v95 the cap counts **word** cards only — char/component seeds
(familyTransfer, production, cascade subchars) sort ahead of words in
the queue, so letting them consume slots starved word reviews.

---

## Surface architecture

```
                        ┌────────────────┐
URL hash routing  ───▶  │   App.tsx      │
                        └───────┬────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   Home view              Modal stack             Full-screen pages
   ─────────              ────────────            ─────────────────
   SavedShelf             EntitySheet             ReviewLaunch
   SearchBar              ├ DecompositionTree     ReviewPage
   ResultsList            │  └ NodeCard           ├ CombinedRecognitionCard
   ComponentTable         ├ NodeCard              ├ FamilyTransferCard
                          └ (stroke + mnemonic)   ├ ProductionCard
                                                  └ DisambiguationCard
                                                  PhoneticsPage
                                                  SentenceStudio
                                                  ClusterRecall
```

### Routing

Two patterns coexist:

- **Modal stack** (`useModalStack`) pushes hash entries like
  `#/w/<word>` or `#/c/<char>` and integrates with `history.pushState`
  so the OS back button pops a layer. A stack entry is
  `{ kind: "word"|"char", key, view?: "sheet"|"tree" }` — `view`
  defaults to `"sheet"` (EntitySheet); `"tree"` renders the full d3
  `TreeModal`.
- **Top-level pages** (`#/review`, `#/phonetics`, `#/sentence`): a
  plain `hashchange` listener in `App.tsx` toggles a flag. No modal-
  stack involvement.

The combined recognition card has a launch screen (`ReviewLaunch`)
between `#/review` and the actual review session — `App.tsx` holds
the launched flag locally.

### Drill component contract

See [ADR-0007](../decisions/0007-tap-anywhere-to-advance.md) for the
authoritative contract. Summary:

- Mounted with `key={rid(current)}` so React unmounts cleanly between
  queue items.
- Owns its own pick state; receives `onGrade(rating)` from the parent.
- Renders a small `.drill-skip` button visible only **before** answer.
- No timers. Tap-anywhere-to-advance after answering.

---

## Patterns to reuse

### Adding a new drill type

1. Define a new facet string in `Facet` (`src/hooks/useReview.ts`).
2. Add a seed rule to `expectedCards` (the `useMemo` returning the set
   of `(kind, key, facet)` tuples that should have cards).
3. Add the facet to the auto-facet drop list so removed items clean up.
4. Write a `<FooCard>` component in `src/components/`. Follow the
   drill contract.
5. Add a routing branch in `ReviewPage.tsx` keyed on
   `current.facet === "foo"`.
6. Add an option in `ReviewLaunch`'s `ALL_FACET_OPTIONS`.
7. Add the seeding rule to `scripts/test-review-seeding.mjs`'s
   re-implementation of `expectedCards`. Cover positive + negative
   cases.

### Adding a new persisted user-state field

1. Migration `00NN_<topic>.sql`: `ADD COLUMN IF NOT EXISTS` (see
   [ADR-0005](../decisions/0005-additive-migrations-and-shape-fallback.md)).
2. Update the hook's load path to ask for the wide shape first with a
   narrow-shape fallback (`/relation .* does not exist/i` or
   `/column .*foo.*/i`).
3. Sync writes are fire-and-forget; treat "column not found" errors
   as benign.
4. Re-run the Setup Supabase workflow with the PAT after deploy so the
   migration applies.
5. **Don't auto-merge** PRs that include a migration. Add a "re-run
   Setup Supabase" note to the PR body.

### Adding a new test

Tests are headless ES modules under `scripts/`. To avoid pulling in a
TypeScript transpiler, when a function lives in `.ts` the test
re-implements the body and keeps it in sync. Production code that's
test-coupled gets a comment naming the test file.

For functions that are plain JS today (`componentSearch.mjs`,
`confusionClusters.mjs`), import directly.

---

## PWA / offline (v96)

All three surfaces install and run offline from one service worker
(`vite-plugin-pwa` / Workbox, `registerType: autoUpdate`, scope
`/chineseapp/`).

- **Precache** — the Vite app shell only (~600 KB: hashed JS/CSS,
  index.html, icons). New deploys activate immediately
  (`skipWaiting` + `clientsClaim`), so the `chinese vNN` label stays
  trustworthy after one reload.
- **Runtime caches** — `data-chars.json` + `phonetic-components.json`
  (StaleWhileRevalidate; ~3 MB, refreshed behind the response);
  `network/` + `components/` pages (NetworkFirst — they're copied into
  the site *after* the Vite build, so they can't be precached and are
  offline only after first visit); `cdn.jsdelivr.net`
  (CacheFirst 30 days — hanzi-writer, cytoscape, per-char stroke data).
- **Not cached** — everything Supabase. User data stays cloud-first
  ([ADR-0001](../decisions/0001-supabase-source-of-truth.md)); offline
  reads come from the hooks' own localStorage mirrors, not the SW.
- The SPA navigate-fallback is denylisted for `/network/`,
  `/components/`, `/storybook/` so the SW never shadows those real
  files with index.html.
- The graph pages register the same `../sw.js` and carry the manifest +
  iOS meta tags, so install works from any surface. Icons are the 中
  glyph drawn as SVG shapes (`public/favicon.svg` + generated PNGs).

---

## Performance notes

- `dueCards` is a `useMemo` over the `cards` Map plus today's
  introduced set. Hot path; the daily cap is implemented here.
- The recognition-pair dedup pre-computes a Set of meaning keys once,
  then walks the queue linearly. O(n) — was O(n²) before v76.
- The decomposition tree's `usageOf` is memoized as a single pass over
  the saved set. O(saved.size) at memo time, O(1) per node.
- The SavedShelf sort pre-computes `pinyin/strokes/hsk/rank` keys once
  per (savedList, strokeCounts) change, then sorts with O(1) Map
  lookups. v76 — pre-v76 sortList recomputed keys per comparison,
  O(n log n × m).

---

## Things to avoid

- `position: absolute` inside `<foreignObject>` on iOS Safari.
- Render-phase `setState` calls (use `useEffect` keyed on the
  triggering dependency).
- Closing over `useState` values in `useCallback` and then calling the
  callback multiple times synchronously. Use the functional setState
  form — [ADR-0008](../decisions/0008-functional-setstate-for-concurrent-grade.md).
- A migration that drops or renames columns. Always additive — [ADR-0005](../decisions/0005-additive-migrations-and-shape-fallback.md).
- Auto-advance timers in drills — [ADR-0007](../decisions/0007-tap-anywhere-to-advance.md).
- Stopping event propagation on every button without considering the
  tap-anywhere advance path.

---

## Open work / explicitly deferred

- **Cross-device deletion propagation** — the cloud-first rework is
  done (all five user-data hooks reconcile on sign-in + focus). The
  one remaining hole: deletions on another device don't propagate to a
  device that still has the item cached. Needs a tombstone column or a
  wholesale "replace local with remote on re-sync" pass. Low priority
  for a single-user app.
- **FSRS optimizer** — train custom params from the review log. Wait
  until ~1000 reviews. Use `@open-spaced-repetition/binding`.
- **Reading-tap incidental review** — tap a char in a reading view to
  apply a soft Again. Needs a reading surface first.
- **Multi-char production drill** — chain Hanzi Writer quizzes across
  all chars of a saved word at ✒ Wrote tier.
- **Tone-colored pinyin** — explicitly cut from the original brief.
- **Stats dashboard** — v66 separates sound + meaning into distinct
  FSRS Cards; the data is there, no UI yet shows the percentages
  side-by-side.
