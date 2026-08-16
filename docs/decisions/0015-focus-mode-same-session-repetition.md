# ADR-0015 — Focus mode repeats problem words within one session

**Status:** Accepted · **Date:** 2026-08-16

## Context

ADR-0014 removed same-day retries: a failed card reschedules to
tomorrow. That is right for the general queue, but some words are
leeches — seen many times (reps ≥ 8), still lapsing (lapses ≥ 4 or
rate ≥ 30%), never stabilizing (< 7 days) — and for those the standard
treatment is massed-then-spaced practice with re-instruction, which a
one-look-per-day queue cannot provide. The existing leech affordance
(disambiguation at lapses ≥ 6) only covers single characters in
hand-curated confusion clusters.

## Decision

A dedicated **Focus mode** (opt-in from the launch screen, `lib/focus.ts`
+ `FocusPage`) takes the top 5 problem words and runs each through
lesson → practice re-test → graded test, rounds interleaved across the
deck so a word's repetitions are spaced by the other words. Only the
final test writes an FSRS grade; the practice answer writes nothing,
so short-term memory does not pollute the schedule. A failed final
test ends with a mnemonic nudge. ADR-0014 stands everywhere else.

## Consequences

- Problem words get concentrated attention without distorting FSRS:
  one honest grade per session, on the format actually tested.
- The word's meaning/sound rows are not directly graded by Focus; the
  next regular review remains their real test.
- Detection thresholds are constants in `lib/focus.ts`, tunable as the
  owner's data accumulates (the v122 `score` log will eventually allow
  fitting them).
