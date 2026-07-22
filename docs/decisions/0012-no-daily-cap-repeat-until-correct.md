# ADR-0012 — No daily new-card cap; repeat-until-correct sessions; one grade per card

**Status:** Accepted; one-grade half (point 3) superseded by ADR-0013 · **Date:** 2026-07-19 (v102)

## Context

ADR-0006's 25/day new-card cap made sense for drip-feeding a growing
deck, but at ~500 saved words it broke the system three ways: the
owner couldn't reach most of their backlog ("I want to repeat all
words I need to repeat"); the v95 word-only cap plus the v98 facet
tiers meant reverse/cloze cards could NEVER pass the cap while >25
new meaning/sound cards existed (both drills showed 0 forever); and a
card graded Again simply left the session instead of coming back.
Separately, grading meaning and sound on two rows per card was twice
the taps for one act of recall.

## Decision

1. **No cap.** `dueCards` returns everything due, ordered
   char/component → meaning/sound → reverse/cloze → oldest first. The
   `introducedToday` machinery is deleted. Session size is the user's
   own choice — they leave when they leave.
2. **Repeat until correct.** A card graded Again re-enters the
   session queue at the end (session-local retry copy; the FSRS row
   already took the Again) and keeps returning until answered without
   Again. "A word is repeated when it is repeated, not when the
   session finishes."
3. **One grade per recognition card.** The combined card takes a
   single Again/Good/Easy that is applied to BOTH the meaning and
   sound FSRS rows (rows stay separate in storage — per-modality
   history is preserved; they simply move together from now on). The
   launch screen shows one "Recognition" toggle.

## Consequences

- Reverse/cloze counts populate; the due badge is the honest backlog.
- Long backlogs produce long queues — by explicit owner preference.
- Meaning/sound retention curves will converge going forward; the
  review log (0011) keeps per-facet ratings if that ever needs
  revisiting.
- Supersedes the cap half of ADR-0006; leech interleaving survives.
