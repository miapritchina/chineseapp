# Design Doc

Architecture and decision log for the Chinese learning app. Pair with
`CLAUDE.md` (which is the file-tree + dev-tips reference). This doc
captures *why* — the constraints, the trade-offs, the patterns to
follow when extending.

---

## What the app actually is

A web-based Chinese-character learning app, mobile-first, deployed as
static files to GitHub Pages with one Supabase project behind it.
Four pages share the deployment under `/Ai-/`:

| Path | Tech | What it does |
|---|---|---|
| `/` | React + TS + Vite | Search dictionary, save words, decomposition tree, SRS review |
| `/network/` | Cytoscape.js + plain HTML | Word-graph of the saved set |
| `/components/` | Cytoscape.js + plain HTML | Words → chars → components graph |
| `/palette/` | Plain HTML + WebGL | Unrelated watercolor app |

The non-React pages are *deliberately* outside the React app — they're
"experiments that might be deleted." Coupling is one line in
`.github/workflows/pages.yml` (a `cp`) and one link in `App.tsx`'s
hamburger. Removing a page is removing those two anchors.

## Mobile-first constraints that shape everything

- **iPhone Safari**, used in short sessions (3–7 min, multiple per day).
- **No dev tools.** A blank screen is a blocker; we put diagnostic
  overlays directly on the page when the build started painting
  blank (`src/main.tsx` ErrorBoundary + inline error script in
  `index.html`).
- **iOS Safari + `<foreignObject>` + `position: absolute`** has a
  well-known bug where absolutely-positioned children silently fail
  to paint. Hit this in v47; flipped to flex layouts inside
  foreignObject and added a comment to never reintroduce.
- **Safari ITP** evicts localStorage after 7 days idle. That's the
  reason Supabase exists in this stack at all.
- **Touch ergonomics.** Tap targets ≥ 44px. Tap-anywhere-to-advance
  instead of small buttons where possible. The launch screen's
  primary action is a single big button.

## Data layer

### Three sources of truth

| Source | What lives there | When it ships |
|---|---|---|
| `public/data-chars.json` | ~10k chars + components + etymology | Static, built once via `extract-chinese.mjs` |
| `public/phonetic-components.json` | Top-250 productive sound components | Static, built via `extract-phonetic-components.mjs` |
| Supabase `words` table | ~91k words: pinyin, defs, HSK, rank | Static seed via `seed-supabase.mjs`; queried at runtime |
| Supabase `user_saves`, `user_fsrs_state`, `user_mnemonics`, `user_sentences`, `user_sentence_draft` | User-private state — **the source of truth** | Live; `localStorage` is an offline read-cache only |

### Data persistence policy (user directive)

Supabase is the source of truth for **all** user data — saved words,
statuses, FSRS state, mnemonics, sentences (composer draft + saved
sentences). `localStorage` is permitted **only as an offline
read-cache**: hydrate from it for instant paint, then reconcile against
the DB with the DB winning. Public derivable data (dictionary rows,
`data-chars.json`, stroke data, the per-day new-card counter) may stay
cached locally — user state that exists nowhere else may not. Every new
user-data feature ships with a table + RLS + sync from day one.

Done: the Sentence Studio is on board — `useSavedSentences` →
`user_sentences` (PK `user_id,hanzi`, so re-saving bumps `created_at`),
`useSentenceDraft` → `user_sentence_draft` (one row per user); migration
`0009_user_sentences.sql`; cloud wins on sign-in, local is the cache.

Open gap (pre-dates the directive): `useSaved` / `useReview` /
`useMnemonics` still treat `localStorage` as authoritative when signed
out — they need the same flip so the DB always leads. Until then the
cloud-mirror pattern below is the *current* behavior for those three,
not the *target* one.

### Why chars are static but words are not

The `chars` data is 548 KB gzipped and the decomposition tree walks it
recursively to depth 5. Batching depth-N fetches over HTTP for every
tree open is a latency cliff for no real win. Words are 3.9 MB
gzipped — too heavy for first-load on mobile; one-keystroke debounced
fetches are tolerable.

### Cloud-first + local cache pattern

Every persisted state follows the same shape (target shape — see the
persistence policy above for the gap between this and today's code):

1. `useFoo` hook owns a Map<key, value> in React state.
2. On first paint, hydrate from `localStorage` so there's no flash.
3. On `userId` change (sign in), the hook does ONE catch-up sync:
   - Read remote → it wins; merge into state; refresh the local cache.
   - Any local-only entries (offline edits) get uploaded.
4. Each mutation writes to React state, refreshes the `localStorage`
   cache, and writes through to Supabase fire-and-forget.
5. Network/migration errors are downgraded to warnings — the app keeps
   working offline, then reconciles on the next successful sync. The
   local copy is a cache, never the authority.

Files: `useSaved.ts`, `useReview.ts`, `useMnemonics.ts` follow most of
this (they currently treat the local copy as authoritative when signed
out — a known gap). New persisted state should clone the *target*
pattern and ship a DB table from the start; never local-only.

### Migration discipline

Every Supabase migration is **idempotent** and **additive-only**.

- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- `DROP POLICY IF EXISTS` before `CREATE POLICY`
- `DROP FUNCTION IF EXISTS` before `CREATE FUNCTION` (Postgres won't
  let you change a `RETURNS TABLE` shape via `CREATE OR REPLACE`)

The Setup Supabase workflow loops over every `migrations/*.sql` in
order, so any of them might run twice. They have to be safe under
re-run. **Never write a destructive migration.**

The front-end always queries the WIDEST shape first; on `column not
found` it falls back to a narrower shape. This means a Supabase
migration can lag the deployment by hours and the app degrades
silently rather than 500ing.

## Status model

Four mutually-exclusive tiers per saved item:

| Tier | Column | Implies saved? | What surfaces in review |
|---|---|---|---|
| ★ Saved | (saved_at) | yes | `meaningRecognition` + `soundRecognition` |
| ❗ Need to learn | `review_at` | yes (auto) | same |
| 🎓 Learned | `learned_at` | yes (auto) | same |
| ✒ Wrote | `wrote_at` | yes (auto) | + `production` (Hanzi Writer trace) |

The fourth-tier column is named `review_at` for historical reasons; the
UI shows "Need to learn". The four columns enforce a "**at most one of
`{learned_at, wrote_at, review_at}` non-null**" invariant by client
convention (no DB constraint — the convention is enforced in
`useSaved.setStatus`).

Why this shape and not an enum:
- Additive migrations: adding a fifth tier (`mastered_at`?) doesn't
  require an ALTER TYPE.
- Each tier carries its own timestamp for free, useful for stats.
- Rollback safety: a buggy client that sets two of them at once
  doesn't crash anything — the priority lookup picks the highest.

The status reads as `getStatus(key)`: priority is wrote > learned >
review > saved.

## SRS layer

### Why ts-fsrs

FSRS-6 scheduler, retention target 0.9. The brief covers the
empirical case (FSRS-6 wins log-loss against SM-2 in ~99% of Anki
collections; 20–30% fewer reviews for the same retention). The
package is MIT, browser-ready, maintained by the spec authors. We
ship near-default parameters until the user has ~1,000 reviews; then
the optional `@open-spaced-repetition/binding` package can re-train.

One non-default knob: **`enable_short_term: false`**. ts-fsrs ships
intraday "learning steps" (`["1m","10m"]`) on by default — a brand-new
card graded Good only moves ~10 minutes into the future and needs a
*second* Good (or one Easy) to graduate to a real interval. For a
review-once-a-day app that reads as "I reviewed this and it came right
back" — the schedule looks broken. With short-term disabled the first
Good schedules straight from initial stability (~3 days for Good).
Again still recurs quickly (same-day / next-day). Existing cards stuck
in a Learning state graduate automatically on their next grade — no
migration. Covered by `scripts/test-fsrs.mjs` ("a brand-new card
graded Good is due at least a day out").

### Item kind × facet

Each scheduled "thing" is a tuple `(item_kind, item_key, facet)`. Three
kinds, six facets:

| Kind | Facet | Surface | Seed rule |
|---|---|---|---|
| word | meaningRecognition | combined recognition card | every saved word |
| word | soundRecognition | combined recognition card (same surface) | every saved word |
| char | phoneticTap | "tap the sound part" drill | chars inside saved words that have a `type === "sound"` component |
| component | componentSound | "what sound does this give?" multi-choice | saved single-chars in `phonetic-components.json` |
| char | familyTransfer | "you know 青, what about 情?" multi-choice | up to 2 family members per saved phonetic component, picked from chars the user hasn't saved |
| char | production | Hanzi Writer trace quiz | single-char saved items at ✒ Wrote tier |

`recognition` is a legacy facet name for items seeded pre-v66; the
load path renames them to `meaningRecognition` in memory.

The combined recognition card grades BOTH facets at once but they're
two FSRS Cards under the hood — so retention numbers stay distinct
per-modality (user request: "separate metrics for sound vs look").

### Cascade math

When the user grades a *word* Good/Easy, `useReview.grade` walks the
word's recursive `componentClosure` (via `src/lib/componentSearch`)
and applies a damped Good to every constituent char's
`meaningRecognition` card:

- Half-step between previous stability and what a real Good would
  give (interpolated 50/50).
- Due date pulled back proportionally.
- For never-direct-reviewed cards: cap at S = 7 days so a single
  word review can't "graduate" an unseen char.
- Reps / lapses / `last_review` are NOT bumped — this isn't a direct
  review.

`Again` does NOT cascade. The user attributes the failure manually
via the "what threw you?" affordance.

### Daily cap + active interleaving

- **Daily new cards cap = 25.** Tracked in localStorage as
  `{ date, ids[] }`; resets when the date rolls. Once 25 new cards
  have been seeded today, further new cards drop out of the visible
  queue until tomorrow.
- **Active leech interleave.** When a card surfaces with
  `card.lapses >= 6` AND its key is in `CONFUSION_CLUSTERS`, the
  disambig view paints once that session, and the *other* cluster
  members get force-surfaced (pulled from the full `cards` map even
  if not currently due) so the user contrasts them back-to-back.

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
   SavedShelf             TreeModal               ReviewLaunch
   SearchBar              ├ DecompositionTree     ReviewPage
   ResultsList            │  └ NodeCard           ├ CombinedRecognitionCard
   ComponentTable         ├ NodeCard              ├ PhoneticTapCard
                          └ CharPopup             ├ ComponentSoundCard
                             (stroke + mnemonic)  ├ FamilyTransferCard
                                                  ├ ProductionCard
                                                  └ DisambiguationCard
                                                  PhoneticsPage
                                                  ClusterRecall
```

### Routing

Two patterns coexist:

- **Modal stack** (`useModalStack`): pushes URL hash entries like
  `#/w/<word>` or `#/c/<char>` and integrates with `history.pushState`
  so the OS back button pops a layer.
- **Top-level pages** (`#/review`, `#/phonetics`): a plain
  `hashchange` listener in App.tsx toggles a flag. No modal-stack
  involvement.

The combined recognition card has a launch screen (`ReviewLaunch`)
between `#/review` and the actual review session — `App.tsx` holds
the launched-flag locally.

### Drill component contract

Every drill component shares:

- Mounted with `key={rid(current)}` so the card identity changes
  between queue items and React unmounts/remounts cleanly.
- Owns its own `picked` (or equivalent) state.
- Receives `onGrade(rating)` from the parent. **No timers** —
  v71+ requires tap-anywhere-to-advance, no auto-advance.
- Renders a small `.drill-skip` button at the bottom that's only
  visible **before** the user answers.
- Audio is opt-in:
  - PhoneticTap speaks the parent char on mount (the parent is the
    prompt, not the answer).
  - ComponentSound and FamilyTransfer speak only AFTER pick
    (playing it before would be the answer).
  - Combined recognition speaks on reveal.

### Tap-anywhere-to-advance

Combined recognition card has the click handler on the outer
`.combined-card-surface` that fills `.review-body`. Internal buttons
stop event propagation only when *not yet `allGraded`*. Once both
grades are picked, any click bubbles to the surface and fires the
advance handler.

This was the v75 fix — pre-v75, the grade buttons stopped propagation
unconditionally and blocked the post-grade tap-anywhere advance.

### Concurrent grade dispatch (the v76 bug fix)

The combined recognition card fires `onGradeMeaning` and `onGradeSound`
back-to-back when the user taps to advance. Pre-v76, `useReview.grade`
captured `cards` in its `useCallback` closure and ran `setCards(next)`
synchronously. Two `grade()` calls in the same tick each saw the SAME
old `cards` snapshot — the second call's `setCards` overwrote the
first's update.

**Fix: every state mutation in `useReview` uses the functional setState
form (`setCards(prev => …)`)** so each invocation sees the latest
state. The pattern:

```ts
let changedRows: ReviewCard[] = [];
setCards((prev) => {
  // … mutate based on `prev`, not on a closed-over `cards`
  changedRows = […];      // re-assigned every invocation so StrictMode
  return next;            //   double-invoke doesn't duplicate the
});                       //   remote upsert
if (changedRows.length) remoteUpsert(changedRows);
```

If you add a new mutation method to `useReview`, **clone this
pattern**. The audit caught the bug because the user reported a
post-grade tap-anywhere "doing nothing"; the underlying cause was one
of the two facet grades silently disappearing.

## Patterns to reuse

### Adding a new drill type

1. Define a new facet string in `Facet` (`src/hooks/useReview.ts`).
2. Add a seed rule to `expectedCards` (the `useMemo` returning the
   set of `(kind, key, facet)` tuples that should have cards).
3. Add the facet to the auto-facet drop list so removed items clean
   up.
4. Write a `<FooCard>` component in `src/components/`. Follow the
   drill contract above.
5. Add a routing branch in `ReviewPage.tsx` keyed on
   `current.facet === "foo"`.
6. Add an option in `ReviewLaunch`'s `ALL_FACET_OPTIONS` so the user
   can toggle it on/off.
7. Add the seeding rule to `scripts/test-review-seeding.mjs`'s
   re-implementation of `expectedCards`. Add cases for positive +
   negative seeding.

### Adding a new persisted user-state field

1. Migration `0008_user_saves_foo.sql`: `ADD COLUMN IF NOT EXISTS`.
2. Update the hook's load path to ask for the wide shape first with
   a narrow-shape fallback (`/relation .* does not exist/i` or
   `/column .*foo.*/i`).
3. Sync writes are fire-and-forget; treat "column not found" errors
   as benign.
4. Re-run the Setup Supabase workflow with the PAT after deploy so
   the migration applies.
5. **Don't auto-merge** PRs that include a migration. Add a
   "re-run Setup Supabase" note to the PR body so the user knows.

### Adding a new test

Tests are headless ES modules under `scripts/`. To avoid pulling in
a TypeScript transpiler, when a function lives in `.ts`, the test
re-implements the body and keeps it in sync. Production code that's
test-coupled gets a comment naming the test file.

For a function that's plain JS today (`componentSearch.mjs`,
`confusionClusters.mjs`), import directly.

## Performance notes

- `dueCards` is a `useMemo` over the `cards` Map plus today's
  introduced set. Re-runs when either changes. Hot path; the daily
  cap is implemented here.
- The recognition-pair dedup pre-computes a Set of meaning keys
  once, then walks the queue linearly. O(n) — was O(n²) before v76.
- The decomposition tree's `usageOf` is memoized as a single pass
  over the saved set. O(saved.size) at memo time, O(1) per node.
- The SavedShelf sort pre-computes `pinyin/strokes/hsk/rank` keys
  once per (savedList, strokeCounts) change, then sorts with O(1)
  Map lookups. v76 — pre-v76 sortList recomputed keys per
  comparison, O(n log n × m).

## Things to avoid

- `position: absolute` inside `<foreignObject>` (iOS Safari).
- Render-phase `setState` calls (use `useEffect` keyed on the
  dependency that triggers the reset).
- Closing over `useState` values in `useCallback` and then calling
  the callback multiple times synchronously. Use the functional
  setState form.
- A migration that drops or renames columns. Always additive.
- Auto-advance timers in drills (user explicitly cut them in v63).
- Stopping event propagation on every button without considering
  the tap-anywhere advance path.

## Open work / explicitly deferred

- **Cloud-first rework, part 2** (user directive) — the Sentence Studio
  is done (migration `0009`, `useSentenceDraft` / `useSavedSentences`
  now DB-led). Still to do: flip `useSaved` / `useReview` /
  `useMnemonics` so the DB is authoritative even when signed out (today
  they treat the local copy as the source of truth offline). See the
  Data persistence policy.
- **FSRS optimizer** — train custom params from the review log.
  Wait until the user has ~1,000 reviews. The package is
  `@open-spaced-repetition/binding`.
- **Reading-tap incidental review** — tap a char in a reading view
  to apply a soft Again. Needs a reading surface first; out of
  scope.
- **Multi-char production drill** — chain Hanzi Writer quizzes
  across all chars of a saved word at ✒ Wrote tier.
- **Tone-colored pinyin** — explicitly cut from the original brief.
- **Stats dashboard** — v66 separates sound + meaning into distinct
  FSRS Cards; the data's there, no UI yet shows the percentages
  side-by-side.
