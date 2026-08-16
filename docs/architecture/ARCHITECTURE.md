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
to GitHub Pages with one Supabase project behind it — a single React
surface under `/chineseapp/` (search, save, decomposition tree, SRS
review, Explore, Classic, Sentence Studio; Storybook rides along at
`/storybook/`).

One React surface since v109: the Explore page
(`src/components/ExplorePage.tsx`, spec in
[explore-page.md](../product/explore-page.md)) replaced the static
Cytoscape `network/` + `components/` graph pages and the Phonetics
list — focus-stack browsing with a breadcrumb trail and saved-set
connection badges.

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
| `public/sanzijing.json` | 三字经 standard edition (178 numbered couplets) + Giles 1900 translation + modern interpretation | Static; curated from Wikisource/ctext (v100–v101) |
| Supabase `words` table | ~91k words: pinyin, defs, HSK, rank | Static seed via `seed-supabase.mjs`; queried at runtime |
| Supabase `user_saves`, `user_fsrs_state`, `user_mnemonics`, `user_sentences`, `user_sentence_draft` | User-private state — **the source of truth** | Live; `localStorage` is an offline read-cache only |
| Supabase `user_review_log` | Append-only grade log (v99) — raw material for future FSRS parameter optimization. Since v104 also records `wordInference` outcomes (prev_card null), and `useWordInference` reads recent rows back so answered inference words rest across devices. Auto-graded drills also store their raw 0–1 `score` (additive column, migration 0014; null for self-graded rows) | Live; insert from `useReview`, select from `useWordInference` |
| Supabase `user_classic_progress` | Furthest-read 三字经 couplet (v101) — scroll-tracked bookmark, max(local, remote) merge | Live; `useClassicProgress` |
| Supabase `user_shares` | Profile share tokens (v110): one stable 12-char token per account; `get_profile_words(token)` resolves to the owner's LIVE saved set (SECURITY DEFINER), so a `?share=` link imports the profile as it is at click time. `words` column = courtesy snapshot for pre-v110 clients (`get_shared_words`) | Live; share flow in `App.tsx`, import in `useAutoImport` |

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

Two tiers per saved item since v99 ([ADR-0011](../decisions/0011-two-tier-status-model.md)):

| Tier | Column | Surfaces in review |
|---|---|---|
| ★ Saved | (row presence) | all word drills |
| 🎓 Learned | `learned_at` | same |

Legacy `wrote_at` / `review_at` columns remain (additive policy) and
map on read: wrote → Learned, review → Saved. The production (trace)
drill now seeds for every saved single character instead of the
retired ✒ Wrote tier. Column-shape history: [ADR-0003](../decisions/0003-four-status-tier-model.md) (superseded).

---

## SRS layer

### Scheduler

`ts-fsrs` FSRS-6 at retention 0.9, with one non-default knob:
`enable_short_term: false`. See [ADR-0002](../decisions/0002-fsrs-short-term-steps-disabled.md).

### Item kind × facet

Each scheduled "thing" is a tuple `(item_kind, item_key, facet)`. Three
kinds, seven scheduled facets (plus one session-only drill):

| Kind | Facet | Surface | Seed rule |
|---|---|---|---|
| word | `meaningRecognition` | combined recognition card | every saved word |
| word | `soundRecognition` | combined recognition card (same surface) | every saved word |
| word | `reverseRecognition` | gloss → pick the hanzi (v98) | every saved word |
| word | `clozeChar` | masked-char pick (v98) | saved words with ≥2 chars |
| component | `familySweep` | spot-the-component grid (v98; reworded v107 — tap every character containing the component) | saved phonetic components with ≥3 usable family members |
| char | `production` | Hanzi Writer trace quiz | every saved single character (v99; was ✒ Wrote tier) |

`wordInference` (v98, drill 1 in [recognition-drills.md](../product/recognition-drills.md))
has no FSRS row: unsaved words built from known chars — a correct
guess cascade-credits the constituent char cards. Since v104 an
answered word (right OR wrong) is done and rests for 14 days: recorded
immediately in localStorage (`chinese.inferenceSeen`) and logged to
`user_review_log` under the `wordInference` facet, which signed-in
devices read back so the rest-period follows the account. Word-kind
facets beyond meaning/sound sort after meaning/sound in the due queue
(there is no daily cap since v102).

`clusterRecall` (v107) is the second synthetic facet: one card per
cluster of related saved words (`buildClusters` in drillGen, computed
in App), no FSRS row of its own. Since the exercise-system rebalance
the single group grade is gone: the card collects which members were
missed (✗ chip per revealed word) and `useReview.gradeCluster` grades
each member individually — missed → Again, recalled → Good — touching
only meaning/sound rows that are **due now**, with cascade credit
deduped to once per component across the whole cluster
(`planClusterGrades` in drillGen). It replaced the standalone Cluster
recall page/button.

**Auto-graded drills score, they don't rate** (rebalance stage 3):
reverse, cloze, family sweep and production report a 0–1 performance
score (`familySweepScore`, `productionScore` in drillGen — sweep is
hits/(members+wrongTaps), production is 1−wrongStrokes/strokeCount);
`scoreToRating` in `lib/fsrs.ts` is the single boundary mapping it to
an FSRS rating (1 → Good, ≥0.75 → Hard, else Again — never Easy:
hint-rich formats aren't recall-strength evidence). A wrong pick on
the two multiple-choice drills grades Hard instead of Again once the
card has lapses ≥ 2, so 25%-guess-floor mis-taps stop feeding leech
detection. The raw score is logged to `user_review_log.score`
(additive column, migration 0014; self-graded rows leave it null).
The cloze card hides the word's gloss until after the pick — with it
visible the drill collapsed into reverse recognition.

`recognition` is a legacy facet name from pre-v66 cards; the load path
renames them to `meaningRecognition` in memory. `phoneticTap`,
`componentSound` (dropped v85, scrubbed v95) and `familyTransfer`
(dropped v107 — owner saw no value) are retired facets — legacy rows
are ignored on load and scrubbed locally.

The combined recognition card asks for TWO grades on one reveal —
Meaning and Sound rows, each applied to its own FSRS row; a swipe
applies one rating to both (v105,
[ADR-0013](../decisions/0013-split-meaning-sound-grades-on-one-card.md),
which supersedes v102's single blended grade). Char-kind items that
only had a meaning row get the sound sibling seeded on first grade.
The two-dispatch same-tick write is what forced
[ADR-0008](../decisions/0008-functional-setstate-for-concurrent-grade.md)
(since superseded in v95 by a ref-mirrored map — `cardsRef` in
`useReview` — so both same-tick grades also reach the Supabase upsert).

### Cascade

Good/Easy on a word damp-credits every constituent char. Again does
not cascade. See [ADR-0004](../decisions/0004-cascade-credit-on-good-not-again.md).
Credit bookkeeping (rebalance stage 4): `applyCascadeCredit` stamps
`last_review` (so the sync merge's recency tie-break keeps the
credited row instead of reverting it to a stale remote copy) but
preserves `state`/`learning_steps`/`reps`/`lapses` — a never-reviewed
card stays New and its first real grade schedules as a first review.

The same damped-credit math powers the **passive-view credit**
(v108): opening a saved item's EntitySheet applies
`applyCascadeCredit` to its own meaning/sound rows, capped at 2 days
(`PASSIVE_CAP_DAYS`), no rep recorded, throttled to once per item per
day (`chinese.passiveCredit` localStorage log). Browsing counts a
little; it never replaces answering. Suppressed while a review
session is active (v110) — drills open sheets for tapped glyphs, and
crediting the current card would push it out of the due queue before
it was graded. Learn mode (`LearnPage`, material from `lib/learn.ts`)
reuses the same credit as its "introduced" marker: a finished lesson
card nudges the word's schedule without recording a rep.

Sift mode (v113, `SiftPage` + `lib/sift.ts`) is grading, not credit:
a right-swipe applies a real Good to every facet of the word that is
due at that moment — except `production` (rebalance stage 2): a
recognition self-report can't clear a writing card. A left-swipe ("I
don't know this") opens the word's lesson inline — the same `LearnCard`
Learn mode uses (extracted v125). Finishing the lesson counts as
having just seen the word (v126): the passive-view credit plus
`snoozeItem` — a schedule-only floor (`snoozeCard` in `lib/fsrs.ts`)
that moves every still-due row to tomorrow without touching stability,
reps, or state — so the word isn't re-tested minutes after being
studied. Left-swipes live in a day-stamped localStorage
list (`chinese.siftKept`) — per-day ephemeral, the same local-only
carve-out as the old daily new-card counter.

Focus mode (v127, `lib/focus.ts` + `FocusPage`, [ADR-0015](../decisions/0015-focus-mode-same-session-repetition.md))
is attention for **problem words** — total reps ≥ 8 across a word's
FSRS rows, still lapsing (≥ 4 lapses or ≥ 30% lapse rate), stability
under 7 days — ranked worst-first. A session takes the top 5:
every word's lesson (`LearnCard`), then a practice re-test (reverse,
no FSRS write), then a graded test (cloze for multi-char, reverse for
single-char) — rounds interleaved so repetitions are spaced within
the session. Only the graded test writes (via the percent path); a
failed one ends with a mnemonic nudge that opens the word's sheet.

"Just start" (v114, `lib/flow.ts`) chains surfaces from one tap:
review with the saved settings → a 2-word Learn lesson. Sift was
dropped from the chain in v123 (owner call: Sift is standalone triage
for sifting out too-simple words, not a workout stage — it keeps its
own launch button). App holds the remaining-stage queue; each page
takes an optional `onComplete` (wired only while a next stage exists)
that fires when its deck drains. Backing out of a stage clears the
queue.

### Queue + leech interleaving

No daily cap since v102 ([ADR-0012](../decisions/0012-no-daily-cap-repeat-until-correct.md)) —
everything due surfaces. Since v106 the default session order is an
activity **interleave**, not a grouped run: `interleaveByActivity`
(drillGen) round-robins across drill groups (meaning/sound unified),
most-overdue first within each group, the neediest group leading each
cycle; `wordInference` rotates last (synthetic dueAt). The Shuffle
toggle replaces this with a full random order. Cards graded Again
leave the session and come back tomorrow — FSRS schedules an Again
exactly 24 h out ([ADR-0014](../decisions/0014-no-same-day-retry.md);
the v102 repeat-until-correct rule is retired). Session
size is chosen on the launch screen (v110: 10 / 25 / 50 / All,
default 25, persisted) — a frozen first-N set UI-side, so the
session genuinely ends; scheduling is untouched since every card
grades individually. Exiting a session returns to the launch screen,
not the home page. `lapses ≥ 6` items with cluster
entries still get side-by-side disambig ([ADR-0006](../decisions/0006-daily-cap-and-leech-interleave.md), leech half).

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
                                                  ClassicPage
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
- **Top-level pages** (`#/review`, `#/explore`, `#/classic`,
  `#/sentence`, `#/stats`): a plain `hashchange` listener in
  `App.tsx` toggles a flag. No modal-stack involvement.

The combined recognition card has a launch screen (`ReviewLaunch`)
between `#/review` and the actual review session — `App.tsx` holds
the launched flag locally.

### Drill component contract

See [ADR-0007](../decisions/0007-tap-anywhere-to-advance.md) for the
authoritative contract. Summary:

- Mounted with `key={rid(current)}` so React unmounts cleanly between
  queue items.
- Owns its own pick state; receives `onGrade(rating)` from the parent.
- Skip lives in the page header (`PageHeader onSkip`, v105 — moved out
  of the thumb zone), not inside the card.
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

The app installs and runs offline from one service worker
(`vite-plugin-pwa` / Workbox, `registerType: autoUpdate`, scope
`/chineseapp/`).

- **Precache** — the Vite app shell only (~600 KB: hashed JS/CSS,
  index.html, icons). New deploys activate immediately
  (`skipWaiting` + `clientsClaim`), so the `chinese vNN` label stays
  trustworthy after one reload.
- **Runtime caches** — `data-chars.json` + `phonetic-components.json`
  (StaleWhileRevalidate; ~3 MB, refreshed behind the response);
  `cdn.jsdelivr.net`
  (CacheFirst 30 days — hanzi-writer + per-char stroke data);
  `dict.youdao.com` (CacheFirst 180 days — per-word TTS MP3s, v106:
  primary review audio, device Web Speech is the offline fallback —
  see `src/lib/speech.ts`).
- **Not cached** — everything Supabase. User data stays cloud-first
  ([ADR-0001](../decisions/0001-supabase-source-of-truth.md)); offline
  reads come from the hooks' own localStorage mirrors, not the SW.
- The SPA navigate-fallback is denylisted for `/storybook/` so the SW
  never shadows those real files with index.html. Icons are the 中
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
