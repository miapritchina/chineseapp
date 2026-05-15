# Repo Development Guide

> **For the design rationale**, see `DESIGN.md` (architecture, status
> model, SRS facet split, cascade math, cloud-first sync pattern).
> This file is the file-tree + dev-tips reference.

> ## ⚑ Data persistence policy (user directive — do not weaken)
>
> **Supabase is the source of truth for every piece of user data** —
> saved words, statuses, FSRS scheduler state, mnemonics, and sentences
> (composer draft *and* saved sentences). `localStorage` is allowed
> **only as an offline read-cache**, never authoritative: on load, hydrate
> from it for instant paint, then reconcile against the DB with the DB
> winning. Anything else cached locally must be derivable public data
> (dictionary rows, `data-chars.json`, HanziWriter stroke data, the
> per-day "new cards introduced" counter) — never user state that exists
> nowhere else.
>
> **Every new user-data feature ships with a Supabase table + RLS + sync
> from day one.** Do not merge a feature whose state lives only in
> `localStorage`. If a migration is involved, follow the additive pattern
> (`CREATE TABLE IF NOT EXISTS`, idempotent) and don't auto-merge — the
> user re-runs the Setup Supabase workflow.
>
> Implemented: every user-data hook (`useSaved`, `useReview`,
> `useMnemonics`, `useSentenceDraft`, `useSavedSentences`) hydrates from
> its `localStorage` cache for instant paint, then reconciles against
> Supabase on sign-in **and on every tab focus** (throttled ~20s) — DB
> wins on conflict (per-key newer-wins where a timestamp exists; for FSRS
> cards, more-reps-wins so a re-sync can't drop a just-graded card).
> Tables: `user_saves`, `user_fsrs_state`, `user_mnemonics`,
> `user_sentences` (PK `user_id,hanzi`), `user_sentence_draft` (one row
> per user). **Known limitation:** the merge is union-with-remote-wins,
> so a *deletion* made on another device doesn't propagate to a device
> that still has the item cached locally (no tombstones) — fixing that
> needs a tombstone column or a "wholesale replace on re-sync" pass; not
> done yet.

Four web apps deployed together via GitHub Pages:

- **Chinese** (root) — React + TypeScript + Vite app at `/`. Character learning
  with role-tagged decomposition tree, stroke animations, etymology, saved
  words, four-status SRS, and three drill types.
- **Palette** (`palette/`) — Watercolor painting app, single-file static HTML at
  `/palette/`. Untouched by the Chinese app.
- **Network** (`network/`) — Cytoscape.js word-graph of the user's saved set
  at `/network/`. Static HTML, reads localStorage directly. Easily deletable.
- **Components** (`components/`) — Cytoscape.js vocabulary-structure graph at
  `/components/` (words → chars → component sub-pieces, all from the user's
  saved set). Static HTML, easily deletable.

## File structure

```
/
├── index.html                       Vite root entry, drives <App />
├── src/
│   ├── main.tsx                     ErrorBoundary + on-page diag overlay
│   ├── App.tsx                      orchestrates everything
│   ├── styles.css
│   ├── components/
│   │   ├── SearchBar                two modes: Dictionary / By component
│   │   ├── ResultsList              search results
│   │   ├── SavedShelf               home grid w/ status sections + sort pills
│   │   ├── ComponentTable           empty-state for By-component search
│   │   ├── Card / NodeCard          shared word + tree-node cards
│   │   ├── TreeModal                full recursive decomposition tree (d3) page — view: "tree"
│   │   ├── DecompositionTree        d3-hierarchy + d3-zoom + foreignObject cards
│   │   ├── EntitySheet              unified word/char/component sheet (bottom sheet mobile / modal desktop) — view: "sheet"
│   │   ├── HamburgerMenu            top-bar drawer (Review / Phonetics / Network …)
│   │   ├── StatusButton             4-tier status dropdown shared by every place
│   │   ├── ReviewPage               full-screen SRS surface, routes by facet
│   │   ├── PhoneticTapCard          drill: tap the sound component
│   │   ├── ComponentSoundCard       drill: pick the pinyin a component gives
│   │   ├── DisambiguationCard       leech-cluster side-by-side compare
│   │   ├── PhoneticsPage            list + save the top-250 productive components
│   │   ├── SentenceStudio           build-a-sentence (E2) composer + POS bank
│   │   ├── AuthButton + SignInModal magic-link auth
│   ├── hooks/
│   │   ├── useDictionary            Supabase RPC + cache for word lookups
│   │   ├── useChars                 fetches public/data-chars.json
│   │   ├── useSaved                 4-status localStorage + Supabase mirror
│   │   ├── useReview                ts-fsrs scheduler at word/char/component level
│   │   ├── usePhoneticComponents    fetches public/phonetic-components.json
│   │   ├── useMnemonics             per-word/char user notes
│   │   ├── useSentenceDraft         composer draft → user_sentence_draft (one row/user) + localStorage cache
│   │   ├── useSavedSentences        saved sentences → user_sentences (PK user_id,hanzi) + localStorage cache
│   │   ├── useStrokeData            per-session HanziWriter cache
│   │   ├── useModalStack            history.pushState integration for tree modals
│   │   └── useAuth                  supabase.auth wrapper
│   └── lib/
│       ├── types.ts                 Word, Char, Component, Role, Status…
│       ├── pinyin.ts                tone-stripping
│       ├── pos.ts                   POS heuristic for Sentence Studio tabs
│       ├── search.ts                client-side ranking (legacy)
│       ├── speech.ts                Web Speech API helper
│       ├── tree.ts                  buildCharTree, strokeRoleForIndex
│       ├── componentSearch.mjs+.d.ts recursive-closure search + freq map
│       ├── confusionClusters.mjs+.d.ts hand-curated leech clusters
│       ├── fsrs.ts                  ts-fsrs wrapper + cascade math
│       ├── share.ts                 encode/decode the saved set ↔ ?share= link
│       └── supabase.ts              client + wakeUp ping
├── public/
│   ├── data-chars.json              ~10k chars + components + etymology
│   ├── phonetic-components.json     top-250 productive sound components
│   └── favicon.svg
├── design-system/                   UI reference (NOT built/served) — see "Design system reference"
│   ├── DESIGN-SYSTEM.md             tokens, type scale, component inventory, proposals
│   ├── design-tokens.css            standalone :root token file (mirrors src/styles.css)
│   └── style-guide.html             dependency-free living style guide
├── palette/                         (untouched: HTML/CSS/JS watercolor app)
├── network/index.html               (static word-graph page)
├── components/                      (static vocab-structure graph page)
│   ├── index.html
│   └── graph-data.mjs
├── scripts/
│   ├── extract-chinese.mjs          chinese-lexicon → public/data*.json
│   ├── extract-phonetic-components.mjs ranks sound components, dumps JSON
│   ├── seed-supabase.mjs            bulk-loads ~91k words via service role
│   └── test-*.mjs                   eleven headless test files (npm test)
├── supabase/
│   └── migrations/
│       ├── 0001_dictionary.sql
│       ├── 0002_user_saves.sql
│       ├── 0003_user_saves_learned.sql
│       ├── 0004_search_words_rich.sql
│       ├── 0005_user_saves_wrote.sql
│       ├── 0006_user_saves_review.sql      "Need to learn" tier (review_at)
│       ├── 0007_fsrs_state.sql              SRS scheduler state
│       ├── 0008_user_mnemonics.sql          per-key mnemonics
│       ├── 0009_user_sentences.sql          Sentence Studio: saved sentences + composer draft
│       └── 0010_user_shares.sql             "Share my words" short-link table + get_shared_words RPC
├── package.json                     react, d3, ts-fsrs, supabase-js, lz-string
├── vite.config.ts
├── tsconfig.json
└── .github/workflows/pages.yml      builds Vite, copies palette/, network/, components/
```

## `palette/` — watercolor app

Single-file HTML app. All logic is an IIFE inside `palette.html`. Relies on
`mixbox.js` sitting next to it (relative `<script src="mixbox.js">`).

Key components:
1. **Color palette** — 12 pigment swatches with dry-paint texture.
2. **Mixing wells** — 2D canvas with per-pixel latent-space color mixing via mixbox.
3. **Drawing canvas** — WebGL fluid simulation for watercolor physics.
4. **Water jar** — Tap to dilute brush, hold to clean.

WebGL watercolor engine (`FluidSim` class):
- Velocity field with advected Navier-Stokes + pressure solve (20 Jacobi iterations).
- Dye field stores pigment absorption, not RGB.
- Wetness field tracks paper water; dries edges inward.
- Paper texture is procedural noise for dry-brush + granulation.
- Capillary flow migrates pigment to drying edges (edge darkening).
- Granulation lets pigment settle into paper valleys.

Display shader converts absorption → visible color: `paintColor = 1.0 - dye`.

Color mixing uses **mixbox** latent space (7-dim) for subtractive pigment mixing.
Wells store per-pixel latent buffers; brush picks up mixed color on contact.

### Known palette issues / debugging

- **Float texture filtering** — mobile GPUs (e.g. iPhone) often lack
  `OES_texture_float_linear`. Without it, `texture2D()` returns `(0,0,0,0)` when
  sampling FLOAT textures with `GL_LINEAR`. Fix: detect extension and use
  `GL_NEAREST` when float linear is unavailable. Debug log shows
  `FloatLinear:false`.
- **Absorption values must stay < 1.0** per channel. The splat shader adds
  `(1 - rgb/255) * strength` to the dye. Keep strength ≤ 0.5.
- Debug log (bottom-right overlay) watches for `LINK ERR`, `GL ERR`,
  `SHADER ERR`. `Frame1 OK` confirms pipeline.

Mobile (iPhone) layout: `@media (max-width: 600px)` stacks palette on top,
canvas below. Only 2 mixing wells (3rd+ hidden). `touch-action: none` on body,
pointer events for painting (works with finger + Apple Pencil).

Development tips:
- Version string bottom-right (`page:palette vX`) — bump on each push to verify
  deployment.
- Paint transfer to wells: `dabOnWell()` — controls opacity, stroke fade, color
  pickup. Loaded brush deposits ~150 dabs empty / ~60 dabs painted before
  transitioning to mixing.

## Chinese app — root

React + TypeScript single-page app, built with Vite. `hanzi-writer` is loaded
via jsDelivr CDN (declared in `index.html`); stroke SVG data is auto-fetched
by hanzi-writer from `hanzi-writer-data` on CDN.

### Data pipeline

- **Words** live in Supabase (`oigbbgtzzqiceetasayy.supabase.co`), table
  `words`. Search runs through the `search_words(text)` RPC for tiered
  server-side ranking. Schema + indexes in
  `supabase/migrations/0001_dictionary.sql`. Bulk-load via
  `node scripts/seed-supabase.mjs` (needs `SUPABASE_SERVICE_ROLE_KEY` env
  var). See `supabase/README.md`.
- **Chars** ship as a static file, `public/data-chars.json` (~10k entries,
  548 KB gzip). Generated by `node scripts/extract-chinese.mjs`.
- **Phonetic components** ship as `public/phonetic-components.json` (~30 KB,
  top-250 productive sound components ranked by how many other chars use
  them). Generated by `node scripts/extract-phonetic-components.mjs`.
- **User-private state** (saved words, statuses, FSRS scheduler,
  mnemonics, sentences + composer draft) lives in Supabase tables
  `user_saves`, `user_fsrs_state`, `user_mnemonics`, `user_sentences`,
  `user_sentence_draft`. RLS policies restrict to `auth.uid() =
  user_id`. **Supabase is the source of truth** (see the Data
  persistence policy at the top); `localStorage` is only an offline
  read-cache. (`user_shares` also exists — short-link records for
  "Share my words" — but it's deliberately *not* authoritative state:
  it holds a copy of `user_saves` keyed by a public token, owner-only
  for writes, readable by anyone holding the token via the
  `get_shared_words` RPC.)

### Data shapes

- `words` row: `{ word, pinyin, searchable_pinyin, definitions: jsonb, hsk,
  rank, trad?, definitions_text }`. Hydrated client-side into `Word` with
  `simp = word` and `chars = [...word]`.
- `data-chars.json`: `{ chars: { [char]: { pinyin, definitions,
  originalMeaning, notes, components: [{char, type, fragment, …}],
  hasEtymology } } }`. Component `type` ∈
  `iconic | meaning | sound | simplified | deleted | unknown` — drives the
  role-color CSS variables (`--role-*`) and the phoneticTap drill (correct
  answer = the component with `type === "sound"`).
- `phonetic-components.json`: `{ generated, components: [{ char, pinyin
  (tone-free), pinyinTones, count, family: [chars…] }] }`.
- `user_saves`: `(user_id, word)` PK + nullable `learned_at`, `wrote_at`,
  `review_at` timestamps. At most one of those three is set per row. The
  fourth-tier label is "Need to learn" in the UI but the column stays
  `review_at` for back-compat.
- `user_fsrs_state`: `(user_id, item_key, item_kind, facet)` PK +
  serialized ts-fsrs `Card` JSONB + denormalized `due_at`, `last_review_at`.
  `item_kind` ∈ `word | char | component`; `facet` ∈ `recognition |
  phoneticTap | componentSound | familyTransfer | production` (only the
  first three actually seed today).

### Status model (4 mutually-exclusive tiers)

| Icon | Status | Column | Drills active |
|---|---|---|---|
| ★ | Saved | (saved_at) | recognition |
| ❗ | Need to learn | review_at | recognition |
| 🎓 | Learned | learned_at | recognition |
| ✒ | Wrote | wrote_at | recognition (production drill not built yet) |

Picking any tier ensures the row is saved. Picking "remove" deletes it.
Picking a different tier flips the bits — only one of `{learned_at,
wrote_at, review_at}` is non-null at a time.

### SRS — review surface

`useReview` hook owns the scheduler:

- Wraps `ts-fsrs` (open-spaced-repetition/ts-fsrs, MIT). FSRS-6 at
  retention 0.9, **`enable_short_term: false`** — the intraday learning
  steps (`["1m","10m"]`) are off, so a brand-new card graded Good
  schedules a real multi-day interval immediately instead of bouncing
  back in ten minutes. (Without this the schedule felt broken: a word
  you "reviewed" reappeared on the next page open.) `src/lib/fsrs.ts`
  is the thin wrapper: `seedCard`, `gradeCard`, `applyCascadeCredit`,
  `serialize/deserialize`, `isDue`.
- **All saved words** get a recognition card (saving == queue for learning,
  per the user's stated "learn all my words" goal — statuses are about
  progression, not about whether something is scheduled).
- **Cascade**: a Good/Easy on a word also walks its recursive
  `componentClosure` and applies a damped Good (50% interpolated stability,
  capped at 7-day due if the child has never been reviewed alone) to every
  char inside. Again does NOT cascade — the user can attribute the
  failure to a specific child via the "what threw you?" affordance.
- **Drill facets** (each its own card per (item, facet) row):
  - `recognition` (look → meaning + pinyin reveal-style; Again / Good / Easy)
  - `phoneticTap` (tap the sound component; auto-grade Good or Again).
    Seeded for any char with at least one `type === "sound"` component.
  - `componentSound` (multi-choice "what sound does this give?";
    auto-graded). Seeded for any saved single-char item that's in
    `phonetic-components.json`.
- **Confusable cluster disambig**: when a card's `card.lapses ≥ 6` AND its
  key is in `confusionClusters.CONFUSION_CLUSTERS`, the review page
  paints a side-by-side `DisambiguationCard` once per session before
  letting the user grade.

`ReviewPage` routes by facet — there's a per-facet branch (Disambiguation
→ ComponentSound → PhoneticTap → recognition default).

### Pages reachable from the hamburger menu

- **Review** (`#/review`) — SRS queue. Hamburger badge shows "N due".
- **Phonetics** (`#/phonetics`) — list of top-250 productive sound
  components, each with pinyin + family + a StatusButton.
- **Sentence** (`#/sentence`) — Sentence Studio. Compose a sentence by
  tapping chips drawn from your saved words; POS tabs filter the bank.
  You can also type pinyin (or hanzi) into the composer to filter the
  bank to matching saved words — tapping a match appends it and clears
  the input (Enter appends the first match; Backspace on an empty input
  pops the last token). Sentences can be saved (Save button next to
  Copy) — they're listed under the composer, tap to reload, × to
  delete. Pure UX, no schedule effect. The draft and saved sentences
  sync to Supabase (`user_sentence_draft` / `user_sentences`) — cloud
  wins on sign-in; `localStorage` (`e2.draft` / `e2.sentences`) is the
  offline cache. POS detected by `src/lib/pos.ts` (lookup tables for
  closed-class + def-prefix heuristic — the dictionary doesn't carry
  POS tags so we infer).
- **Network** (`/Ai-/network/`) — static Cytoscape graph; `?focus=<key>`
  centers + highlights a saved word/char on load (used by CharPopup's
  "Show in network →" button).
- **Components** (`/Ai-/components/`) — static Cytoscape vocabulary-
  structure graph (words → chars → components, all bounded by saved set).
- **Share my words** — not a page; an action. Two link flavours, chosen
  at share time (`shareMyWords` in `App.tsx`):
  - **Short link** (`?share=<12-char token>`) — used when the user is
    signed in: `shareMyWords` inserts a `user_shares` row
    (`token PK, user_id, words jsonb, created_at`) and the link is just
    the token, so it stays tiny no matter how big the saved set is.
  - **Inline link** (`?share=<lz-string blob>`) — the fallback for
    signed-out users (and when the DB insert fails or the table doesn't
    exist yet): the whole list compressed straight into the URL, no
    backend. `lz-string`'s `compressToEncodedURIComponent` keeps it
    ~2.5–3× shorter than plain base64-of-JSON; `decodeWords` also still
    understands that original uncompressed base64 format (links shared
    before v88).
  Handed off via `navigator.share` (mobile) or the clipboard
  (desktop / fallback). Opening such a link fires the `?share=` handler
  in `App.tsx`: if the value looks like a token (`looksLikeShareToken`),
  it calls the `get_shared_words(token)` RPC (a `SECURITY DEFINER`
  function so anyone with the link can read that one row's words without
  enumerating the table); otherwise — or on a DB miss — it decodes the
  inline payload. Then confirm → `importSaved` (which syncs to
  `user_saves` as usual). Encode/decode/token logic lives in
  `src/lib/share.ts`; round-trip + token behaviour pinned by
  `scripts/test-share.mjs`. The `user_shares` table is non-authoritative
  (the words it holds are a copy of `user_saves`); RLS is owner-only for
  write/own-read, public token reads go through the RPC. (Sibling of the
  older `?import=<same-origin-json-url>` and `?clear=1` query-param
  handlers.) Migration `0010_user_shares.sql` — additive/idempotent;
  re-run the Setup Supabase workflow to apply it (the app falls back to
  inline links until then).

### Search has two modes

- **Dictionary** — Supabase `search_words` RPC (tiered: exact hanzi → prefix
  → substring → pinyin → English-gloss).
- **My words by component** — local-only walk of every saved word's
  recursive `componentClosure`; AND-filter across multiple Han chars in
  the query. Empty input renders `ComponentTable`, a chip grid of every
  component appearing in the saved set ranked by occurrence count.

### Runtime architecture (`src/`)

- `App.tsx` orchestrates: search debounce, modal stack, popup, review
  page route, phonetics page route.
- `useDictionary` calls Supabase RPC + caches `Word` rows.
- `useChars` fetches `data-chars.json` once.
- `useSaved` owns the four status maps (saved/learned/wrote/review) +
  syncs to `user_saves`. Exposes `getStatus`, `setStatus`, four set
  views, `importSaved`, `clearAll`.
- `useReview` owns FSRS scheduling; mirrors `user_fsrs_state`. Exposes
  `dueCards`, `grade(itemKey, rating, kind?, facet?)`,
  `attributeFailure(childKey)`.
- `useModalStack` integrates with `history.pushState` for the modal
  back-button stack. A stack entry is `{ kind: "word"|"char", key,
  view?: "sheet"|"tree" }` — `view` defaults to `"sheet"` (EntitySheet);
  `"tree"` renders the full d3 `TreeModal`. App.tsx renders only the
  top entry. Tapping anything (home grid, search result, tree node,
  a piece inside a sheet) does `push({ kind, key })` — i.e. opens a
  sheet, which can stack. Tapping the `⤢` in a sheet does
  `push({ ...top, view: "tree" })`. Top-level pages (Review, Phonetics,
  Sentence) use plain `#/foo` hash routing in App.tsx instead.
- `useStrokeData` is a per-session cache around
  `HanziWriter.loadCharacterData`.
- `DecompositionTree` mounts d3-hierarchy + d3-zoom on an SVG ref; node
  cards are React components rendered into `<foreignObject>` slots
  positioned by d3 layout. Card heights estimated per-content; layout
  reflows accordingly.
- `EntitySheet` is the unified detail surface (replaces the old
  CharPopup + WordDetail): a bottom sheet on mobile (drag-handle,
  slides up, swipe down to dismiss), a centered modal on desktop.
  Opened by every word / character / component tap. Takes either a
  `word` (multi-char) or a `charKey`; a single-char word renders the
  same as a bare character. Sections: eyebrow (`PINYIN · TONE n ·
  TOP n`) → tappable stroke animation (single chars) or 🔊 (words) →
  POS + glosses → `Nº 01 · ETYMOLOGY` / `MADE OF` (one level — each
  piece is a button into its own sheet; the `⤢` opens the full d3
  tree) → `Nº 02 · IN YOUR SAVED WORDS` (chars) / `CHARACTERS` (words)
  → `💡 MAKE IT STICK` mnemonic → "Show in network →". The static
  `/network/` page's own popup is left separate (different codebase).

### Tests

`npm test` chains eleven headless Node test files under `scripts/` — ~105
cases total. All run with stock Node (no build, no jsdom).

- `test-components.mjs` — graph-data builder for `/components/` page
- `test-component-search.mjs` — recursive component-closure search +
  frequency map for the by-component search mode
- `test-fsrs.mjs` — ts-fsrs lifecycle + cascade math
- `test-review-seeding.mjs` — `expectedCards` rule (which `(item, kind,
  facet)` tuples should have a card seeded). Covers all six facets
  including `meaningRecognition` / `soundRecognition`, `phoneticTap`,
  `componentSound`, `familyTransfer`, and `production`.
- `test-phonetic-components.mjs` — verifies the build artifact's shape +
  componentSound seed predicate
- `test-confusion-clusters.mjs` — cluster lookup helpers used by the
  leech disambig view
- `test-pinyin.mjs` — `normalizePinyin` tone-stripping + multibyte
  edge cases; `tonePattern` / `toneLabel` per-syllable tone numbers
- `test-mnemonics.mjs` — `buildStarterMnemonic` template against
  role-tagged components
- `test-cluster-recall.mjs` — `pickCluster` picker: phonetic-family
  preference, shared-char fallback, plain-sample fallback, size cap
- `test-pos.mjs` — `detectPos` heuristic used by the Sentence Studio
  POS tabs (lookup tables + def-prefix patterns)
- `test-share.mjs` — `encodeWords` / `decodeWords` round-trip behind the
  "Share my words" link (url-safe base64, UTF-8, garbage-token handling)

Where a function lives in TypeScript and the test needs a pure-JS
counterpart (e.g. the `expectedCards` rule inside `useReview`), the
test re-implements the function and the production code keeps a
short comment naming the test file as the canonical fixture. Keep
them in sync if the rule changes.

### Adding new words to the dictionary

The seed is the entire chinese-lexicon (~91k words filtered: CJK only,
length ≤ 8, not a proper noun, not just a cross-reference). To regenerate
after a chinese-lexicon update:
1. `npm install` (picks up new chinese-lexicon version).
2. `node scripts/extract-chinese.mjs` — writes `public/data-chars.json`.
3. `node scripts/extract-phonetic-components.mjs` — writes
   `public/phonetic-components.json`.
4. Commit those files.
5. Re-run seed-supabase to reload the `words` table:
   `SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-supabase.mjs`.

## Design system reference

`design-system/` holds the canonical UI reference — **use it when designing
or restyling screens, and keep it in sync with the code**:

- `DESIGN-SYSTEM.md` — colors, typography + type scale, spacing/radii/
  shadows/breakpoints/z-index, motion, layout patterns, the component
  inventory, and componentization proposals. Also imports cleanly into
  Claude Design.
- `design-tokens.css` — a standalone `:root` token file (colors, `--pos-*`,
  `--role-*`, type scale, spacing, radii, shadows, z-index) mirroring
  `src/styles.css`. Some tokens are *normalized/aspirational* — they
  promote values the code still inlines (status hues, grade colors, the
  type scale) to named tokens; where this file and `src/styles.css`
  disagree, **`src/styles.css` is authoritative for what ships**.
- `style-guide.html` — a dependency-free living style guide (swatches,
  type scale, component states). Open it in a browser; it isn't built or
  served.

**Reference-only**: nothing in `design-system/` is imported by the app or
copied by the Pages workflow. **Sync rule**: when you change `:root`
tokens in `src/styles.css`, the color constants in `src/lib/pos.ts`, the
role-color mapping, the breakpoints, or add a reusable component/hook
(e.g. the `usePopover` extraction), update `design-system/` in the same
commit. If `design-tokens.css` ever becomes the single source of truth,
have `src/styles.css` `@import` it (or generate one from the other) — not
done yet.

## GitHub Pages deployment

- Workflow: `.github/workflows/pages.yml`.
- Runs `npm ci && npm run build`, copies `dist/` to `_site/`, then copies
  `palette/`, `network/`, and `components/` into the corresponding
  subdirectories.
- Chinese app served at `/`, palette at `/palette/`, network at
  `/network/`, components at `/components/`.
- **Environment protection rules** on the `github-pages` environment must
  allow the current default branch. If deployment shows success but the
  site doesn't update, check Actions → deploy job for "environment
  protection rules" rejection.
- After a Supabase migration lands, the Setup Supabase workflow applies it
  **automatically** on the next push to `claude/main` that touches
  `supabase/migrations/**` — no click needed. It applies migrations +
  refreshes auth config but skips the heavy seed step (re-seeding the
  ~91k-row `words` table is reserved for the manual `workflow_dispatch`
  path, with the "Upsert all ~91k words" checkbox). The workflow reads
  the Supabase PAT from the `github-pages` environment secret `supabaseapi`
  (Settings → Environments → github-pages → Environment secrets). Rotate
  by updating that secret value and revoking the old PAT. The app
  degrades gracefully when a new column/table is missing — sync errors
  are silently downgraded.

## Development tips

- `npm run dev` for a Vite dev server with HMR.
- `npm run build` produces `dist/`; `npm run preview` serves it locally.
- `npm test` runs all eleven headless test files (~105 cases).
- Bump the `chinese vN` version label in the `<HamburgerMenu />` props
  inside `App.tsx` on every push so you can verify the right build is
  live from your phone (the version is shown at the bottom of the
  hamburger menu).
- iOS Safari has long-standing quirks with `position: absolute` inside
  `<foreignObject>`. If a card renders blank with only its connector
  lines visible, that's the bug — switch to in-flow flexbox layout.
