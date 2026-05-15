# TODO

Active work and planned features. Bugs live in [`BUGS.md`](BUGS.md);
shipped items move to [`CHANGELOG.md`](CHANGELOG.md).

Priority: **P0** (do now) · **P1** (next) · **P2** (planned) ·
**P3** (someday / deferred)

---

## P0 — now

| Item | Notes |
|---|---|
| **Refactor stage 4 — QuizCardShell + useSpeech** | Extract the shared header / Again-Hard-Good-Easy footer / speak-on-mount logic from the 5 drill cards (`CombinedRecognitionCard`, `PhoneticTapCard`, `ComponentSoundCard`, `FamilyTransferCard`, `ProductionCard`, `DisambiguationCard`). Adopt the new `GradeHandler` signature from `lib/types.ts`. Tests per drill via React Testing Library. |
| **Refactor stage 5 — split EntitySheet** | 494-line `EntitySheet.tsx` into ≤5 sub-components: `SheetHeader`, `SheetMeta` (pinyin + tone + freq + POS), `EtymologySection`, `RelatedSection`, `MnemonicSection`. Same context dependencies. Snapshot tests for each. |
| **Refactor stage 6 — CSS reorg** | 2,620-line `styles.css` split into `tokens.css` + per-feature files (`shell.css`, `home.css`, `sheet.css`, `review.css`, `sentence.css`, `phonetics.css`). Imported through a single `styles.css` to preserve cascade order. Visual diff check before merging. |

## P1 — next

| Item | Notes |
|---|---|
| Fix [BUG-5](BUGS.md) (Easy grade red border) | Quick fix, high annoyance. Priority #1 in [redesign spec](docs/product/chinese-app-ux-redesign.md). |
| Typography overhaul | Implement the type scale from [redesign spec §3](docs/product/chinese-app-ux-redesign.md#3-typography-overhaul). Present to owner first; biggest visual impact. |
| Fix [BUG-1](BUGS.md) (deep link routes) | Wire `#/c/:char` and `#/w/:word` into the hash router. Cold-load + hashchange. |

## P2 — planned

| Item | Notes |
|---|---|
| **Home page merge** — kill Dictionary / My Words split | [Redesign spec §1A](docs/product/chinese-app-ux-redesign.md#1a-merge-home-page--kill-the-dictionarymy-words-split). Three tabs: Dictionary / My Words by Component / Sentence. |
| **Sentence as a tab** (not a separate page) | [Redesign spec §1B](docs/product/chinese-app-ux-redesign.md#1b-sentence-studio-becomes-a-tab-not-a-separate-page). |
| **Drop 2 drill types** — `phoneticTap` + `componentSound` | [Redesign spec §1C](docs/product/chinese-app-ux-redesign.md#1c-review-drills--drop-2-keep-4). Reduces to 4 recognition + 1 production. |
| Fix [BUG-3](BUGS.md) (search exact-match ranking) | Boost exact hanzi matches above substring. |
| **Graph performance + usability** | [Redesign spec §4G](docs/product/chinese-app-ux-redesign.md#4g-graph-pages--performance--usability). Reduce node count by default; larger tap targets; WebGL renderer if available. |
| **`<Entity>` component unification** (M→P mapping) | [Redesign spec §0](docs/product/chinese-app-ux-redesign.md#0-core-design-primitive--the-entity-component). One component, 5 sizes. Replaces ~13 of the 16 current card types per [card-type catalog](docs/product/card-type-catalog.html). |
| Cross-device deletion propagation | Tombstone column or "wholesale replace" pass. [Open work in ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md#open-work--explicitly-deferred). |
| Fix [BUG-4](BUGS.md) (hamburger dismiss) | Cosmetic; touchstart listener + non-reflow close. |

## P3 — someday

| Item | Notes |
|---|---|
| Status tier icon consistency | [Redesign spec §4K](docs/product/chinese-app-ux-redesign.md#4k-status-tier-icons--consistency). Distinct colors/icons per tier everywhere. |
| Dark-mode role colors lighter (~20%) | [Redesign spec §4I](docs/product/chinese-app-ux-redesign.md#4i-dark-mode-role-colors). |
| Review progress bar | [Redesign spec §4F](docs/product/chinese-app-ux-redesign.md#4f-review-progress-bar). |
| Phonetics page visual refresh | [Redesign spec §4H](docs/product/chinese-app-ux-redesign.md#4h-phonetics-page--needs-visual-refresh). |
| EntitySheet etymology section more prominent | [Redesign spec §4E](docs/product/chinese-app-ux-redesign.md#4e-entitysheet--make-componentsetymology-more-prominent). |
| "Save sentence" button contrast | [Redesign spec §4J](docs/product/chinese-app-ux-redesign.md#4j-save-sentence-button-contrast). |
| Swipe-to-grade in review | [Redesign spec §2B](docs/product/chinese-app-ux-redesign.md#2b-reduce-taps-in-review-flow). |
| More whitespace on drill cards | [Redesign spec §2C](docs/product/chinese-app-ux-redesign.md#2c-more-whitespace-on-drill-cards). |
| Transient hint text (fade after first occurrence) | Drill "tap to continue" hint, sentence composer placeholder. [QA fix UX-2](docs/product/qa-fix-prompt.md). |
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
