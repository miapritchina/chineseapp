# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Version tags
correspond to the `chinese vNN` label shown at the bottom of the
hamburger menu — bumped on every push to main.

Categories: **Added** · **Changed** · **Fixed** · **Deprecated** · **Removed** · **Security**

---

## [Unreleased]

### Changed
- **No same-day retry after a mistake (v112,
  [ADR-0014](docs/decisions/0014-no-same-day-retry.md)):** a card
  answered wrong now leaves the session and comes back tomorrow (the
  scheduler puts an Again exactly 24 h out) instead of re-queuing in
  the same session — an immediate retry only tests short-term memory.
  Session totals no longer grow after mistakes.
- **Etymology boilerplate stripped (v112):** template sentences like
  "Phonosemantic compound. 口 represents the meaning and 厅 represents
  the sound." and bare "Simplified form of 聽." no longer render in
  character descriptions (Learn cards, entity sheet, decomposition
  tree) — they repeat what the role-colored component formula already
  shows and bury the genuinely helpful notes ("The right side looks
  like 斤 (axe) but is actually a corruption of 厅."). Longer
  simplified-form sentences that carry real content are kept; when
  nothing survives, the "Originally: …" line steps in.

### Fixed
- **Learn card's word was cut off at the top (v112, BUG-19):** the
  drill body centers its content, and a centered flex child that
  overflows clips above the scroll origin — tall lesson cards lost
  their hero word on small screens. Auto margins fix it: short
  lessons still center, tall ones scroll from the very top.
- **Wrong answer could freeze the drill (v111, BUG-18):** after a
  mistake, tapping to continue advanced the counter but kept showing
  the answered card whenever the retry resurfaced immediately (short
  queue / last card) — the retry copy shared the old card's React
  key, so the drill never reset. Cards are now keyed per attempt, and
  fast double-taps can no longer double-grade an attempt.

### Added
- **Learn mode (v110):** an exercise that teaches instead of testing.
  "Learn · N words" on the review launch screen walks your
  never-reviewed (then weakest) words through lesson cards: word +
  pinyin + audio, each character broken into role-colored components
  (请 = 讠 speech + 青 qīng) with the dictionary's etymology story,
  plus related words you already know. No grading — finishing a card
  marks the word "introduced" (small schedule nudge, no repetition),
  so its first real review comes soon but not cold. Every glyph opens
  its sheet.

### Changed
- **Session size is your choice (v110):** the launch screen offers
  10 / 25 / 50 / All (default 25, remembered) — replaces the fixed
  25-card session from v107.
- **New-word drill shows pinyin before answering (v110):** the word
  is new — its sound is fair help for guessing the meaning.
- **Every character in every drill is explorable (v110):** once a
  card is answered/revealed, tapping any glyph — the recognition
  focal card, reverse/cloze/sweep option tiles, the New-word
  breakdown, cluster words, confusable-compare cells, the traced
  character — opens its bottom sheet over the session (dotted
  underline marks tappable glyphs where they aren't already cards).
  Close the sheet and the card is exactly where you left it. The
  passive-view credit does NOT apply to sheets opened mid-review —
  it would have silently completed the current card before grading.
- **Sharing shares the profile, not a snapshot (v110, migration
  0013):** "Share my words" now hands out ONE stable short link per
  account. Opening it imports the sharer's saved words **as they are
  at that moment** — resolved live via a new `get_profile_words` RPC
  — so re-opening the same link later picks up everything saved
  since. Words are no longer encoded into the URL when signed in;
  the inline-blob link remains only as the signed-out fallback, and
  old links (short and inline) keep working.

### Added
- **Explore page (v109,
  [spec](docs/product/explore-page.md)):** one browsing surface for
  words ↔ characters ↔ components. Component index (the old Phonetics
  list, now tappable through to focus views) + My-words tab; every
  focus screen shows "in my words" first, then sound family /
  built-with / made-of sections as readable cards; a tappable
  breadcrumb trail (青 › 情 › 情人) tracks the path; `→N` badges count
  connections within the saved set and `end` marks dead ends — the
  graph's "which direction is worth walking" signal without the
  graph. "Explore from here" replaces "Show in network" in the entity
  sheet. Saving components (family-sweep seeding) still works from
  the index rows and focus cards.

### Removed
- **Network, Components, and Phonetics pages (v109):** replaced by
  Explore. The static Cytoscape pages (and the vendored cytoscape.js)
  are gone; the app is a single React surface now.

### Added
- **Browsing counts a little (v108):** opening a saved word/character
  from the main page gives its recognition schedule a partial credit —
  half a Good's stability gain, due date pushed at most 2 days, no
  repetition recorded — throttled to once per item per day. Reading
  through your words is study; it just isn't a full answer.

### Changed
- **Justified word grid (v108):** shelf cards pack as many per row as
  fit, then stretch to fill the row — no more ragged right edge.
  Character sizes and no-truncation behavior unchanged.

### Fixed
- **Graph pages dead on mobile (v108, BUG-17):** network/components
  loaded Cytoscape from the jsdelivr CDN with no error handling — any
  failed or stale fetch left "cytoscape is not defined" and a blank
  page. The library is now vendored into the site
  (`network/vendor/cytoscape.min.js`), no runtime CDN dependency.

### Changed
- **Cluster recall is a drill type (v107):** it joins the launch
  screen toggles and mixes into the session queue (one card per
  cluster of related saved words) instead of being a separate button
  at the bottom.
- **Sessions are 25 cards (v107):** a comfortable visible end — the
  launch button says "25 of N", the progress shows /25, and the
  session actually finishes. Purely UI: every card still grades and
  syncs individually; Again-retries stay in past the cap.
- **Exiting a session returns to the workout chooser (v107)**, not
  the home page.
- **Family sweep reworded (v107):** the prompt now says "tap every
  character that contains 青" — the decoys never contain the
  component, so it's a component-spotting task; the old "takes its
  sound from" framing oversold it.
- **Writing counts distinct wrong strokes (v107, BUG-16):** repeated
  misses on the same stroke cost ONE mistake — the recognizer often
  rejects a correct second attempt, and that shouldn't read as two
  errors. Grade thresholds unchanged (0 → Easy, ≤2 → Good, >2 →
  Again), now over distinct strokes.

### Removed
- **Family transfer drill (v107):** owner saw no value in it. The
  facet is retired like phoneticTap/componentSound — legacy rows are
  scrubbed on load and never seed again.

### Fixed
- **Writing card took seconds to show the character (v106, BUG-15):**
  stroke data was fetched from the CDN only when the card appeared.
  The session now prefetches stroke data for upcoming Writing cards
  in the background, and the service worker keeps it cached — so
  after the first sighting a character's quiz paints instantly, even
  offline.

### Changed
- **Fill-the-gap solved character shows green, not red (v106):** the
  filled-in character used the vermillion accent, which read as "you
  got it wrong" even on a correct pick.
- **Sessions mix activity types by default (v106):** with several
  drills enabled, the queue now round-robins across them (word →
  reverse → cloze → word …) instead of running each type to
  exhaustion. Not a shuffle — within each type the most overdue card
  still comes first, and the neediest type leads. The Shuffle toggle
  still gives a fully random order.
- **Bigger glyphs in picking drills (v106):** family-sweep and
  fill-the-gap option tiles show characters at card size (52 px, were
  22 px); cluster-recall and confusable-compare cells step up to
  36 px. Audited every drill — recognition hero, reverse tiles,
  cloze target, family-transfer target, New-word card, and the
  writing canvas were already large.
- **Review audio switched to neural MP3s (v106):** words are spoken
  with Youdao's dictionary voice (fetched per word, cached by the
  service worker — instant + offline after first play) instead of the
  device speech engine, whose voices distort even at their best
  (owner-verified in the iOS Settings preview). Device TTS remains as
  the automatic fallback when offline or if the endpoint fails.
- **Recognition card asks meaning and sound separately (v105,
  [ADR-0013](docs/decisions/0013-split-meaning-sound-grades-on-one-card.md)):**
  one card, two answers — the reveal shows a Meaning row and a Sound
  row, each grading its own schedule, and the card advances as soon
  as both are picked. Swiping right/left still grades both at once
  (Good/Again). Again on either dimension re-queues the card.
  Character cards that only tracked meaning now grow a sound schedule
  on first grade.
- **Reverse review harder + easier to read (v105):** the word tiles
  show card-size characters (were chip-size), and wrong options are
  now picked to be confusable — preferring words that share a
  character with the answer, match its length, or share a component
  (e.g. 清 baiting 情).
- **Skip moved to the page header (v105):** every review surface now
  shows Skip next to the progress counter, out of the thumb zone, so
  it can't be tapped by mistake while grading. The in-card and
  bottom-row Skip buttons are gone; Skip is also available after
  reveal now. Skipping a recognition card skips both its meaning and
  sound rows (previously the sound sibling popped back up as its own
  card).

### Fixed
- **TTS sounds like an old radio (v105, BUG-14):** three causes —
  the voice picker took the FIRST installed Chinese voice, which on
  iOS is the low-bitrate "compact" Siri voice; the 0.85 playback rate
  forced resampling (warble); and Safari could garbage-collect the
  utterance mid-playback (stutter). Now the highest-quality voice is
  picked (Enhanced/Premium preferred, zh-CN over other regions),
  playback is native-rate, and the utterance is held until it ends.
- **Review glyph invisible in dark mode (v105, BUG-13):** the focal
  character tile stays white in both themes, but the glyph inherited
  the dark-theme text color (near-white on white). The tile now pins
  light-theme ink, so the character reads in both themes.
- **Answered "New words" stay done (v104, BUG-12):** answering an
  inference word — right or wrong — now counts immediately, not at
  session end. Exiting mid-session no longer resets the count: the
  word rests for 14 days (localStorage, plus a `user_review_log` row
  under facet `wordInference` so the rest-period follows the account
  across devices when signed in).

### Changed
- **Cluster recall is now a full session (v103):** one launch walks
  EVERY cluster your saved set can form — phonetic families first,
  then shared-character groups, then random fill, each word used once
  — with cluster-N-of-M progress. Previously it showed a single group
  (and, due to deterministic picking, usually the SAME group) and
  closed after one grade.
- **"New words" is now multiple choice (v103):** pick the meaning
  among 4 options (distractors drawn from your other words); a correct
  pick credits the constituent characters. The reveal shows each
  character as a pinyin → hanzi → meaning stack (the sheet treatment)
  so you see WHY the word means what it means.

### Changed
- **Review overhaul (v102, [ADR-0012](docs/decisions/0012-no-daily-cap-repeat-until-correct.md)):**
  - **No daily cap** — every due card surfaces; the 25/day new-card
    machinery is gone. This also fixes **BUG-9**: Reverse and
    Fill-the-gap always showed 0 because new meaning/sound cards ate
    every cap slot ahead of them.
  - **Repeat until correct** — a card graded Again re-enters the
    session queue at the end and keeps returning until answered
    without Again.
  - **One grade per recognition card** — meaning + sound are answered
    with a single Again/Good/Easy applied to both FSRS rows; the
    launch screen shows one "Recognition" toggle. Swipe right = Good,
    left = Again still works.
  - **"New words" fixed (BUG-10)** — the whole discovered pool
    surfaces (was capped at 5) with a fresh per-session rotation (was
    the same 5 words every time).
  - **Audio fix (BUG-11)** — TTS start was clipped because cancel()
    and speak() fired in the same tick; the utterance is now deferred
    after a cancel and an installed zh voice is selected explicitly.
  - **"Weakest" shelf sort** — new sort pill on the home grid ordering
    words by FSRS stability (never-reviewed and shaky words first).

### Added
- **三字经 v2 (v101):** couplets numbered (№ 1–178); each 3-character
  phrase is now ONE card using the EntitySheet's pinyin → hanzi →
  meaning character stacks (known characters in learned-green, the
  rest muted); a **modern plain-English interpretation** written for
  this app is the primary line with Giles 1900 kept beneath in italic;
  and a **reading bookmark** — scrolling advances a furthest-read
  marker (accent bar on the couplet, "Continue reading at № N" pill on
  return), synced to the new `user_classic_progress` table (migration
  **0012**, RLS, max(local, remote) merge) with a localStorage cache.

### Changed
- **Two-tier status model** ([ADR-0011](docs/decisions/0011-two-tier-status-model.md)):
  the ❗ Need-to-learn and ✒ Wrote statuses are gone from the UI —
  the star menu now offers Saved / Learned only, and the shelf has two
  sections. No data loss: the columns stay and legacy rows map on read
  (wrote → Learned, review → Saved), including on the graph pages. The
  Write (trace) drill now seeds for every saved single character
  instead of the removed Wrote tier (still opt-in).

### Added
- **三字经 reader (v100):** new full-screen page (hamburger → 三字经 ·
  Classic, `#/classic`). The standard 1068-character edition rendered
  as one `<Entity>` card per character (pinyin + gloss from
  data-chars, tap for the full sheet), grouped in couplets with
  Herbert Giles' public-domain translation. Characters that appear in
  your saved words are highlighted, and the header tracks coverage
  ("know N / 513"). Data ships as `public/sanzijing.json` (curated
  from Wikisource/ctext, simplified) with integrity tests.
- **Storybook coverage expanded to the full surface:** SearchBar (all
  modes), ResultsList, ComponentTable, SavedShelf, HamburgerMenu,
  EntitySheet (word/char/back-stack), ReviewLaunch, the complete drill
  catalog (inference, reverse, cloze, family sweep, family transfer,
  production, disambiguation), PhoneticsPage, SentenceStudio,
  DrillShell/SpeakButton/HanziGlyph — all with autodocs prop tables.
- **`user_review_log` table (migration 0011) + grade logging:** every
  direct grade appends `(item, kind, facet, rating, prev_card, time)`.
  This is the raw material the FSRS optimizer needs — current card
  state alone can't train per-user parameters. Insert-only, RLS-owner,
  fire-and-forget; the app never reads it yet.
- **Four new recognition drills** (v98 — [spec](docs/product/recognition-drills.md)),
  all opt-in toggles on the review launch screen:
  - **New words** (`wordInference`, owner's idea): a real word you
    have *not* saved, built entirely from characters inside your saved
    words (电话 + 大脑 → 电脑) — guess the meaning, reveal, self-grade.
    Session-only (no FSRS row); "Got it" cascade-credits the
    constituent characters' cards. Material discovered per session by
    probing known-char pairs against the dictionary
    (`useWordInference` + `lib/drillGen`).
  - **Reverse** (`reverseRecognition`): gloss → pick the hanzi among
    saved-word tiles; distractors prefer words sharing a character.
  - **Fill the gap** (`clozeChar`): a saved word with one character
    masked (你▢) — pick it among confusion-cluster distractors.
  - **Family sweep** (`familySweep`): tap every character that takes
    its sound from a saved phonetic component, decoys mixed in; exact
    set → Good.
  New word-kind facets sit in a lower daily-new-cap tier so they can
  never starve the meaning/sound queue (BUG-6 lesson, enforced by a
  seeding test).

### Fixed
- **Sign-in code input rejected codes longer than 6 digits** (BUG-8):
  Supabase's OTP length is a project setting (6–10 digits; this project
  issues 8), but the input hard-capped at `maxLength=6` so the code
  could not be typed at all. Now accepts up to 10 digits; copy no
  longer promises "6-digit".

## [v96]

### Added
- **PWA (v96):** the app is installable and works offline across all
  three surfaces. `vite-plugin-pwa` service worker (auto-update,
  scope `/chineseapp/`): app shell precached; dictionary JSONs
  stale-while-revalidate; graph pages network-first; jsdelivr CDN
  (hanzi-writer, cytoscape, stroke data) cache-first 30 days. Supabase
  is never SW-cached — user data stays cloud-first. Manifest + iOS
  meta tags on all three pages; new 中 app icon (favicon + 192/512 +
  maskable + apple-touch, drawn as SVG shapes and rasterized).
- **Storybook (v96):** `npm run storybook` /
  `/chineseapp/storybook/` on Pages. Stories for `<Entity>` (all
  sizes + drill flash states), GradeButtons, StatusButton, PageHeader,
  EmptyState, Eyebrow/SectionHeader, CombinedRecognitionCard
  (interactive), SignInModal — rendered inside `AppStateProvider` with
  fixture data. Automated documentation: autodocs prop tables generated
  from TypeScript, plus a token gallery that reads the live
  `styles.css` custom properties at runtime.

### Changed
- **Design-system docs reconciled:** DESIGN-SYSTEM.md §7.1 now
  documents `<Entity>` (the `Card` it described was deleted in v92),
  new §7.24 covers the `src/components/ui/` primitives, and the six
  §8 proposals that shipped in v91 (DrillShell, PageHeader,
  SectionHeader, Eyebrow, EmptyState, SpeakButton) are marked shipped.
  Token audit: no value drift between `design-tokens.css` and
  `styles.css`; doc-only tokens remain the known aspirational set.
- **Sign-in with an emailed 6-digit code** instead of the magic link.
  The modal now has a second step: enter the code
  (`supabase.auth.verifyOtp`, `autocomplete="one-time-code"` so iOS
  autofills from Mail), with a Resend button. Requires the Supabase
  "Magic Link" email template to include `{{ .Token }}`.

### Fixed
- **Review queue no longer clogged by retired drills** (BUG-6): the
  phoneticTap / componentSound drills were dropped from the launch
  screen in v85 but their cards kept seeding — inflating the "N due"
  badge and permanently consuming the 25/day new-card slots (char
  cards sort ahead of words), which starved word reviews entirely once
  enough were queued. Seeding removed; legacy rows are ignored on
  load/sync and scrubbed locally.
- **Daily new-card cap now counts word cards only** — familyTransfer /
  production / cascade char seeds no longer eat intro slots meant for
  new words.
- **Sound-facet grades now reach Supabase** (BUG-7): the second of two
  same-tick grades (combined card fires meaning + sound together) was
  persisted locally but its remote upsert silently no-oped. `useReview`
  now mirrors the cards map in a ref ([ADR-0010](docs/decisions/0010-ref-mirrored-cards-map-in-usereview.md),
  supersedes ADR-0008).
- **Cascade credit applied once per combined review** — previously both
  the meaning and sound grade cascaded to constituent chars, doubling
  the damped credit.

### Removed
- `PhoneticTapCard` + `ComponentSoundCard` components and their
  `ReviewPage` branches (unreachable since v85; completes the TODO P2
  "drop 2 drill types" item — 4 drill types remain).

## [v94]

### Added
- **EntitySheet stack-aware controls:** the dismiss control is now two
  buttons — a back arrow (←) on the left, only shown when the modal
  stack has more than one entry, and a close (✕) on the right that
  empties the stack. Replaces the old single down-chevron.
- **"RELATED WORDS" columns** in the EntitySheet — one column per
  unique character in the key (multi-char-word OR single-char view),
  each listing the user's saved words containing that character via
  `<Entity size="sm">`. Empty columns show a dashed `…` placeholder
  card. Used for both multi-char words and single chars; replaces the
  old "CHARACTERS" / "IN YOUR SAVED WORDS" lists in one component.
- **`<Entity showPos>` opt-in** — POS pill (adj / noun / pronoun …)
  is now off by default. Callers that want it pass `showPos`.
- **Hamburger drawer + in-page entity popup** on `network/` and
  `components/` static pages: replaces the `← 中文` back link with a
  slide-in nav drawer; tap-once-to-focus, tap-again-to-open a popup
  that mirrors the EntitySheet shape (pinyin / hanzi / meaning + MADE
  OF / ETYMOLOGY row) — no redirect to the main app. The components
  page drawer also embeds the role-color legend and word-tier legend
  that previously lived in the bottom-left corner.

### Changed
- **Etymology row** in the EntitySheet is now a true equation: each
  piece (and the result) renders as a pinyin / hanzi / meaning stack,
  pieces sit on a shared hanzi baseline (3-row CSS grid per piece),
  `+` and `=` operators are siblings of the pieces (centered on the
  hanzi row, not on the pinyin row). For multi-char-word "MADE OF"
  the hanzi are plain text — only character → component decomposition
  ("ETYMOLOGY") carries role color.
- **Main-page section alignment:** sort pills and the saved-grid now
  use the same 18px page inset as the search bar interior and the
  `SAVED · N` label — every section starts at the same x.
- **"Make it stick" section removed** from the EntitySheet for now.
  The `MnemonicSection` file still lives under `src/components/sheet/`
  and can be re-mounted when needed.

### Removed
- `src/components/sheet/RelatedSection.tsx` — superseded by
  `RelatedWordsColumns.tsx`. Both `CHARACTERS` (multi-char) and
  `IN YOUR SAVED WORDS` (single-char) presentations are now unified
  into one component.

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
