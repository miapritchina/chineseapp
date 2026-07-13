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
| **Remaining drill candidates** — audio-first + speed sprint | Drills 1–4 shipped v98 ([spec](docs/product/recognition-drills.md)). Left: **audio-first** (TTS-only prompt → pick the hanzi; fold into ReverseRecognitionCard as a prompt mode) and **speed sprint** (timed binary pass over reps>0 cards, no FSRS writes). |
| **Graph performance + usability** | [Redesign spec §4G](docs/product/chinese-app-ux-redesign.md#4g-graph-pages--performance--usability). Reduce node count by default; larger tap targets; WebGL renderer if available. |
| Cross-device deletion propagation | Tombstone column or "wholesale replace" pass. [Open work in ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md#open-work--explicitly-deferred). |
| Fix [BUG-4](BUGS.md) (hamburger dismiss) | Cosmetic; touchstart listener + non-reflow close. |

## P3 — someday

| Item | Notes |
|---|---|
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
