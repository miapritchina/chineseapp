# Recognition drills — candidates + spec (July 2026)

Owner ask: more repetition/exercise methods that *activate
recognition*, including the owner's own idea (drill 1 below). Six
candidates were proposed; the owner picked **1–4 to build** (shipping
v98). 5–6 stay in TODO.md as future options.

Design constraints shared by all drills:

- Recognition-first: prompt with one modality, retrieve another.
- Tap-anywhere-to-advance after reveal ([ADR-0007](../decisions/0007-tap-anywhere-to-advance.md)); objective
  grading wherever the mechanic allows (tap-correct → Good,
  tap-wrong → Again) rather than self-assessment.
- Every drill is a launch-screen toggle. New FSRS-backed facets must
  not starve the meaning/sound queue (see BUG-6 post-mortem): word-kind
  facets beyond meaning/sound get **lower cap priority** — they take
  daily-new slots only after meaning/sound cards have taken theirs.
- User data policy unchanged: FSRS-backed drills live in
  `user_fsrs_state` rows keyed by (item, kind, facet). Drill 1 is
  deliberately *not* FSRS-backed (its material is derived, endless,
  and repeats are undesirable) — it credits existing char cards
  instead.

## Shipped (v98)

### 1 · New-word inference — facet `wordInference` (no FSRS row)

**Owner's idea.** Surface a real, common word the user has **not**
saved whose every character appears in their saved words — e.g. saved
电话 + 大脑 → show 电脑. v103: the user picks the meaning among 4
options (distractor glosses from their other words); the reveal shows
each character as a pinyin → hanzi → meaning stack. Correct pick →
cascade credit; wrong → nothing.

- **Material:** ordered pairs of the user's known characters (from the
  most recently saved words, capped) probed against the dictionary via
  the existing `ensureCached` batch lookup; hits that aren't saved and
  aren't single chars become candidates, common-first (rank). Computed
  once per app session (`useWordInference`), rotated randomly; capped
  per review session so it stays a garnish, not the meal.
- **Scheduling:** no FSRS row. A correct pick applies the standard
  damped cascade credit to every constituent char's FSRS card (same
  rule as a word Good — [ADR-0004](../decisions/0004-cascade-credit-on-good-not-again.md)).
  v104: answering — right OR wrong — marks the word **done for 14
  days** (localStorage `chinese.inferenceSeen`, plus a
  `user_review_log` row under facet `wordInference` that signed-in
  devices read back), so exiting mid-session no longer resets the
  "New words" count.
- **Why it matters:** compositional inference is how Chinese
  vocabulary actually scales; fixed decks can never cover it.

### 2 · Reverse recognition — facet `reverseRecognition` (word kind, FSRS)

Prompt with the **gloss**, pick the right **hanzi** among 4 saved-word
tiles (card-size glyphs since v105). Distractors are scored to be
confusable: shared character > same length > shared component (ties
random). Tap-correct → Good, tap-wrong → Again + reveal. Retrieval in
the meaning→form direction, previously untrained. Seeds one row per
saved word (needs ≥2 saved words to render options).

### 3 · Masked-char cloze — facet `clozeChar` (word kind, FSRS)

A saved multi-char word with one character masked (你□ + gloss); pick
the missing character from 4 options. Distractors come from the
masked character's **confusion cluster** when it has one, else from
other saved-word characters. Seeds one row per saved word with ≥2
characters; the masked position is randomized per surfacing.

### 4 · Family sweep — facet `familySweep` (component kind, FSRS)

For a saved component (青): a grid mixing the characters built with
it (请 情 晴 …) with decoys from other components' families. Tap
**all** of them, then confirm. Exact set → Good, any miss/false pick
→ Again + reveal (missed = outlined, wrong pick = red). Seeds one row
per saved phonetic component whose family has ≥ 3 usable members.
v107 wording note: the prompt says "contains 青" — the decoys never
contain the component, so the task is visual component-spotting, and
framing it as a sound drill oversold it. (The familyTransfer drill
this once extended was retired in v107 — owner saw no value in it.)

## Backlog (in TODO.md)

### 5 · Audio-first recognition
TTS plays the word, no hanzi shown; pick the word among confusable
saved-word tiles. Trains sound→form. (Fold into 2 as a prompt-mode
toggle when picked up.)

### 6 · Speed sprint
Timed binary know/don't-know flash round over already-learned cards
(reps > 0). No FSRS writes — pure exposure volume.

## Implementation map (v98)

| Piece | Where |
|---|---|
| Pure generation/grading helpers | `src/lib/drillGen.ts` (+ vitest) |
| Inference candidate discovery | `src/hooks/useWordInference.ts` |
| Facet seeding + cap priority + inference credit | `src/hooks/useReview.ts` |
| Cards | `WordInferenceCard` / `ReverseRecognitionCard` / `ClozeCharCard` / `FamilySweepCard` |
| Routing + session quota | `ReviewPage.tsx` |
| Toggles + counts | `ReviewLaunch.tsx` |
