# ADR-0013 — Separate meaning + sound grades on the one recognition card

**Status:** Accepted · **Date:** 2026-07-19 (v105)

## Context

ADR-0012 collapsed the recognition card to a single grade applied to
both FSRS rows. That over-read the owner's ask — "answer how good I
remember sound and meaning at the same time" meant *one card, both
questions*, not *one answer*. Remembering what 球 means and
remembering it is qiú are different skills that genuinely diverge.

## Decision

One card, two answers. The reveal shows two labeled grade rows —
Meaning and Sound — each applied to its own FSRS row; the card
advances the moment the second row is picked (no extra tap). A
horizontal swipe stays as the fast path and applies one rating to
both rows (right → Good, left → Again). Again on either dimension
re-queues the card for the session. Char-kind items that historically
had only a meaning row get the sound row seeded on first grade.

## Consequences

- Per-modality scheduling diverges again — a word whose sound keeps
  slipping resurfaces on its own clock. The weakest-first shelf sort
  already reads the min of the two.
- Two taps per card when the answer isn't a clean swipe — the cost
  the owner chose over blended grades.
- Supersedes the one-grade half of ADR-0012; the no-cap and
  repeat-until-correct halves stand.
