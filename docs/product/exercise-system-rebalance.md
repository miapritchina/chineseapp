# Exercise-system rebalance — plan

**Status:** Stages 1–4 built (Aug 16 2026) · stage 5 backlog (TODO P2) · stage 6 direction only · **Date:** 2026-08-16

Owner observation: the exercise system feels unbalanced — not all
exercise types manifest the same proficiency in knowing a word.
This plan is the result of a full review of the drill pipeline
(`ReviewPage`, the seven drill cards, `useReview` grading + cascade,
`lib/fsrs.ts`, `lib/drillGen.ts`, Sift, flow planner). It names the
root cause, lists the per-drill findings, and stages the fixes from
smallest/safest to structural.

---

## Diagnosis

**Every drill grade writes a full-strength FSRS grade regardless of
how much evidence the drill provides.** Retrieval research ranks
evidence strength roughly:

> production (write from memory) > self-graded free recall >
> cued recall > 4-option multiple choice (25% guess floor) >
> self-report ("I know this")

The system treats all of these identically. Two design choices
partially compensate:

- each facet is its own FSRS row, so an MC `Good` only inflates that
  facet's own schedule;
- cascade credit is damped (50% stability, 7-day cap in
  `applyCascadeCredit`).

The imbalance bites where **weak evidence crosses into other rows**:

| # | Leak | Where | Severity |
|---|---|---|---|
| 1 | Cluster recall: one "Knew most" tap → `Good` on meaning **and** sound rows of **every** member (including the one you missed), each meaning `Good` also cascades to its component closure; members graded even when not due; clusters are synthetic (no FSRS row) so every session repeats them | `ReviewPage.tsx` clusterRecall branch | High |
| 2 | Sift right-swipe: recognition self-report grades `Good` on every due facet **including `production`** — a writing card cleared without writing | `App.tsx` `onKnow` | High |
| 3 | Sound facet has no active drill: `soundRecognition` only ever receives self-assessed grades (combined card) or blanket grades (Sift, cluster). Meaning has 4+ active drills | design gap | Medium |
| 4 | Cloze shows the gloss before the pick, collapsing it into reverse recognition — one skill (gloss → hanzi) double-scheduled under two facets | `ClozeCharCard.tsx` | Medium |
| 5 | Grade-scale asymmetry: family sweep is exact-set-or-`Again` (5/6 recalled = full lapse), while production forgives repeated misses per stroke and hands out `Easy` for a clean *trace* (hint-rich, easier than recall) | `FamilySweepCard.tsx`, `ProductionCard.tsx` | Medium |
| 6 | MC drills are binary Good/Again: a mis-tap = full lapse feeding `LEECH_LAPSES` leech detection and FSRS difficulty — noisy on a 25%-guess drill. `Hard` is defined but unreachable everywhere | drill cards, `GradeButtons` | Low-Med |
| 7 | New saved 2-char word seeds 4 cards all due at once (meaning, sound, reverse, cloze) — same word four times in different costumes on day one | `useReview.ts` `expectedCards` | Low (facets are opt-in) |

Code-level findings (not pedagogy, fix in passing):

- **C1** — Cascade/passive credit can be silently reverted by sync:
  `applyCascadeCredit` bumps neither `reps` nor `lastReviewAt`, but
  the reconcile merge resolves equal-reps ties by `lastReviewAt` with
  remote winning — if the credit's upsert fails (offline), the next
  reconcile clobbers the boosted stability.
- **C2** — `applyCascadeCredit` keeps `reps: 0` but adopts the
  post-`Good` `state` (Review): a never-reviewed card stops being
  "new" to ts-fsrs, so its first real grade schedules as a review.
- **C3** — Cluster grading calls `onGrade` per member per facet; a
  4-word cluster with shared components applies cascade credit to the
  same component several times in one tick (credit stacks).

---

## Stages

Each stage is independently shippable, lands green (`npm test`), and
bumps the version on merge. Stages 1–4 are small surgical changes;
stage 5 is a new drill; stage 6 is a direction, not scheduled work.

### Stage 1 — Cluster recall: grade what you actually knew ✅ Built

*Fixes leaks 1 + C3.*

- Replace the single group grade with **tap-to-mark-missed**: after
  revealing, each word is toggleable "missed"; Continue applies
  `Again` to missed members, `Good` to the rest.
- Only grade rows that are **due now** (mirror the Sift `onKnow`
  guard); never grade non-due members.
- Cascade at most once per component per tick: dedupe the closure
  union across members before applying credit (move the loop into a
  single `gradeClusterOutcome` helper in `useReview` rather than N×2
  `onGrade` calls from the card).
- Tests: drillGen/useReview-level — missed member gets `Again`, non-due
  rows untouched, shared component credited once.

### Stage 2 — Sift right-swipe stops clearing production ✅ Built

*Fixes leak 2.*

- `onKnow` grades every due facet **except `production`** (and
  `clozeChar` stays included — it is recognition-adjacent — unless the
  owner prefers to exclude it too; default: exclude only production).
- Copy change on the Sift hint: "done for today everywhere except
  Writing".
- Tests: right-swipe leaves the production row due.

### Stage 3 — Percent scoring for auto-graded drills ✅ Built

*Fixes leaks 4, 5, 6. Owner decision (Aug 16): hybrid percent →
grade. Auto-graded drills compute a 0–100% score; thresholds map it
to an FSRS rating at the boundary; the raw percent is logged.
Self-graded cards (combined recognition) keep the Again/Good/Easy
buttons — humans can't calibrate percentages, and ts-fsrs only
accepts the four discrete ratings anyway.*

- **`scoreToRating(pct)` in `lib/fsrs.ts`** — one shared threshold
  map: `100% → Good`, `≥75% → Hard`, `<75% → Again`. (No `Easy` from
  auto-graded drills: hint-rich formats never provide recall-strength
  evidence.)
- **Per-drill score functions** (pure, in `drillGen.ts`, unit-tested):
  - *Reverse / cloze / audio-first*: correct pick = 100%, wrong = 0%.
    Binary today, but routed through the same `scoreToRating` path so
    later refinements (e.g. response-time discounts) are one-line.
  - *Family sweep*: `hits / (members + wrongTaps)` — 5/6 recalled
    with no decoys ≈ 83% → `Hard` instead of today's full lapse.
  - *Production*: `1 − distinctWrongStrokes / strokeCount`, so a
    clean trace → 100% → `Good` (not `Easy`), a couple of misses on a
    long character costs less than on 三.
  - *Cluster recall* (revisits stage 1): per-member score is binary
    (missed or not), mapped per member.
- **Cloze**: hide the gloss until after the pick (it becomes the
  reveal, alongside the audio). Cloze then tests orthographic /
  collocational knowledge — a genuinely distinct facet from reverse.
- **Log the raw percent**: additive migration adds a nullable
  `score` column to `user_review_log`; drill grades insert it, self-
  graded rows leave it null. This preserves the continuous signal for
  future parameter tuning without touching the scheduler contract.
- **Leech noise**: with `<75% → Again` a single MC mis-tap still
  lapses; cap the noise by grading `Hard` instead of `Again` on MC
  facets when the card's lapses are already ≥ 2.
- Tests: one per score function + the threshold map + log shape.

### Stage 4 — Cascade bookkeeping fixes ✅ Built

*Fixes C1 + C2. No behavior change visible to the owner.*

- `applyCascadeCredit` sets `last_review` to `now` (it already moves
  `due`; recording when the credit happened makes the sync tie-break
  keep the local boost) — `reps`/`lapses` stay untouched.
- Preserve `state` (and `learning_steps`) from `prev` so a
  never-reviewed card stays New until its first real grade.
- Tests: reconcile tie keeps cascaded local row; first real grade on a
  cascade-touched card schedules as a first review.

### Stage 5 — Audio-first drill (sound facet gets real evidence)

*Fixes leak 3. Already on TODO P2 as "audio-first"; this plan makes it
the sound-facet drill rather than a meaning-drill variant.*

- Prompt: TTS audio only (replayable), no hanzi, no gloss → pick the
  word among 4 confusable saved-word options (reuse
  `pickReverseOptions`, biasing distractors toward same/similar pinyin
  when data allows).
- Grades the `soundRecognition` row through the stage-3 percent path. Recognition-pair dedup in `ReviewPage` must not
  collapse it with the combined card the same session.
- Fold into `ReverseRecognitionCard` as a prompt mode (per the
  existing TODO note) to avoid a new component.

### Stage 6 — Direction (not scheduled): schedule the memory, not the drill

The structural alternative to parallel per-drill facets: a small set
of scheduled facets (meaning, sound, writing) with the **drill format
chosen at review time by card maturity** — new/shaky → MC recognition
(cloze/reverse), maturing → self-graded recall, mature → production /
reverse. Drill type then *expresses* proficiency stage instead of
competing with it (Skritter/WaniKani model). Large refactor touching
seeding, launch-screen toggles, and migration of existing rows —
revisit only if stages 1–5 don't dissolve the imbalance in practice.

---

## Order + effort

| Stage | Size | Risk | Depends on |
|---|---|---|---|
| 1 Cluster grading | S–M | Low | — |
| 2 Sift exclusion | S | Low | — |
| 3 Percent scoring | M | Low (adds one additive migration) | — |
| 4 Cascade bookkeeping | S | Low (sync-sensitive, test well) | — |
| 5 Audio-first drill | M | Medium | 3 (grade rule) |
| 6 Maturity ladder | XL | High | evaluate after 1–5 |

Stages 1–4 can land as one PR or individually; 5 is its own PR.
