# TODO

Active work and planned features. Bugs live in [`BUGS.md`](BUGS.md);
shipped items move to [`CHANGELOG.md`](CHANGELOG.md).

Priority: **P0** (do now) · **P1** (next) · **P2** (planned) ·
**P3** (someday / deferred)

---

## P0 — now

Component-architecture refactor (approved plan: `<Entity>` + shared UI components).
Each stage ships green (`npm test` + `tsc`). Supersedes the old "stage 4/5" entries.

| Item | Notes |
|---|---|
| **Stage A — small primitives** | `<EmptyState>`, `<SectionHeader>`, `<Eyebrow>`, `<SpeakButton>` (wraps `lib/speech.ts`), `<PageHeader back tag progress actions?>`. Migrate the duplicated review-header / empty-state blocks. Establishes the first `*.test.tsx` RTL convention. |
| **Stage B — drill chrome** | Export the inline `DrillFrame` from `ReviewPage.tsx` as `<DrillShell>`; extract `<GradeButtons onGrade>` and `<HanziGlyph char animate?>` (consolidates HanziWriter mount+fallback from `EntitySheet` + `ProductionCard`). Migrate the 5 drill cards. (= old "stage 4".) |
| **Stage C — `<Entity>` core (tiny/sm/md)** | New `src/components/Entity.tsx` per [redesign §0](docs/product/chinese-app-ux-redesign.md#0-core-design-primitive--the-entity-component) M→P mapping ([card-type catalog](docs/product/card-type-catalog.html)). Migrate M8/M10/M7/M13/M14/M1. |
| **Stage D — Entity hero + drill pick** | `size="hero"` (white bg) + correct/wrong pick flash. Migrate M11 review hanzi, M12 pick buttons. |
| **Stage E — Entity lg + split EntitySheet** | `size="lg"` w/ recursive breakdown; split `EntitySheet.tsx` into `SheetHeader`/`SheetMeta`/`EtymologySection`/`RelatedSection`/`MnemonicSection` (+ `<MnemonicEditor>`). (= old "stage 5".) |
| **Stage F — `<PillTabs>`** | Unify `search-mode-tabs` + sort-bar + Sentence POS tabs. Independent; any time after A. |

## P1 — next

| Item | Notes |
|---|---|
| Confirm [BUG-1](BUGS.md) (deep links) live | Code is wired (`App.tsx` `parseHash`/`openFromHash` on cold-load + hashchange). Needs one browser pass to close. |
| **Refactor stage 6 — CSS reorg** | 2,620-line `styles.css` → `tokens.css` + per-feature files imported through one `styles.css` to preserve cascade order. Visual diff before merge. Best done after the Entity migration settles the class surface. |

## P2 — planned

| Item | Notes |
|---|---|
| **Remaining drill candidates** — audio-first + speed sprint | Drills 1–4 shipped v98 ([spec](docs/product/recognition-drills.md)). Left: **audio-first** (TTS-only prompt → pick the hanzi; fold into ReverseRecognitionCard as a prompt mode; doubles as [rebalance stage 5](docs/product/exercise-system-rebalance.md) — grades `soundRecognition` via the percent path) and **speed sprint** (timed binary pass over reps>0 cards, no FSRS writes). |
| **Graph performance + usability** | [Redesign spec §4G](docs/product/chinese-app-ux-redesign.md#4g-graph-pages--performance--usability). Reduce node count by default; larger tap targets; WebGL renderer if available. |
| Audio still lags on iOS? (follow-up to v153) | The v153 warm-up assumes an `<audio>` request is served from the service worker's `tts-audio` cache. WebKit has historically not routed media-element requests through the SW, and the endpoint sends no cache headers, so on iOS the warm fetch may not be reused. If cards 2+ still lag on device: play from an `Audio` element preloaded during the warm-up, or serve the MP3s through our own origin (Supabase edge function) with cache headers + CORS, which would also allow blob playback. |
| Cross-device deletion propagation | Tombstone column or "wholesale replace" pass. [Open work in ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md#open-work--explicitly-deferred). |
| Fix [BUG-4](BUGS.md) (hamburger dismiss) | Cosmetic; touchstart listener + non-reflow close. |
| **Sentence bank — "sentences from words I know"** | Owner request (grammar-practice research, 2026-09). Build-time script: Tatoeba zh-en pairs (CC-BY, ~89k) → jieba segmentation (`@node-rs/jieba`, build-time only — never ship a segmenter to the browser) → per-sentence token arrays in static JSON/Supabase. UI: example sentences on the EntitySheet ranked by known-word coverage, plus an i+1 drill (sentences of saved words + exactly one new). Pipeline reference: [HanziGraph](https://github.com/mreichhoff/HanziGraph) (MIT). |
| **Grammar points as first-class content** | Owner request (same research). Backbone: official HSK 3.0 grammar lists ([krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0), JSON). Richer explanations + tagged example sentences: Chinese Grammar Wiki dumps ([krmanik/Chinese-Grammar](https://github.com/krmanik/Chinese-Grammar)) — **CC BY-NC-SA: adopting it permanently forecloses monetizing; needs an ADR**. Surface as Learn lesson cards + link to sentence-bank sentences exhibiting each pattern. |

## P3 — someday

| Item | Notes |
|---|---|
| Live mnemonic generation beyond HSK 1–3 | Follow-up to [ADR-0018](docs/decisions/0018-pregenerated-mnemonic-seeds.md): a Supabase Edge Function holding an Anthropic API key generates a starter for any character on demand (owner must add the secret + billing). Alternative cheap step: pre-generate another HSK 4–6 batch. |
| `npm run lint` fails on main | One pre-existing error: `'Node' is not defined` in `src/hooks/usePopover.ts` — the eslint config is missing the DOM globals for that file. Cosmetic, but it makes the lint output useless as a gate. |
| Phonetics page visual refresh | [Redesign spec §4H](docs/product/chinese-app-ux-redesign.md#4h-phonetics-page--needs-visual-refresh). |
| EntitySheet etymology section more prominent | [Redesign spec §4E](docs/product/chinese-app-ux-redesign.md#4e-entitysheet--make-componentsetymology-more-prominent). Fold into Stage E. |
| "Save sentence" button contrast | [Redesign spec §4J](docs/product/chinese-app-ux-redesign.md#4j-save-sentence-button-contrast). |
| More whitespace on drill cards | [Redesign spec §2C](docs/product/chinese-app-ux-redesign.md#2c-more-whitespace-on-drill-cards). Fold into Stage B. |
| Reading-tap incidental review | Tap a char in a reading view → soft Again. Needs a reading surface first. |
| Multi-char production drill | Chain Hanzi Writer quizzes across all chars of a saved word at ✒ Wrote tier. |
| Stats dashboard | v66 separated sound + meaning into distinct FSRS Cards; data is there, no UI shows it side-by-side. |
| FSRS optimizer | Train custom params from the review log. Wait until ~1000 reviews. `@open-spaced-repetition/binding`. |

## Deferred / cut

| Item | Why |
|---|---|
| Tone-colored pinyin | Explicitly cut from the original brief. |

---

## Conventions

- One line per item in the table. Detail can go inline or link to a
  doc.
- When starting work on an item, no need to move it between
  priorities — change priorities only when external priority changes.
- When done, **remove from this file** and add a `CHANGELOG.md` entry
  in the same commit.
- When a new ADR is needed for the work, write it under
  `docs/decisions/` and link from the TODO entry.
