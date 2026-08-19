# ADR-0016 — Character↔word attention loop

**Status:** Accepted · **Date:** 2026-08-17

## Context

Knowledge flowed only downward: a word's Good damp-credited its
characters (ADR-0004). Upward, nothing: a word built from rock-solid
characters got the same schedule and priority as one hiding a problem
character, and a character that kept sinking words — while never saved
as a word itself — was invisible to Focus mode (ADR-0015). Failure
attribution existed (v57's "what threw you?") but allowed one blamed
character, appeared only on the recognition card, and fed nothing.

## Decision

Close the loop, both directions, treating attribution as accumulating
evidence rather than proof (post-error self-blame is noisy):

1. **Attribution captures more**: multi-select on the panel, shown
   after failed recognition AND reverse cards; cloze attributes its
   masked character automatically (it knows exactly what failed).
2. **Problem characters** (lib/focus.ts): lapses ≥ 3 across a char's
   rows with stability still < 7 days — a looser rule than problem
   words because attribution histories are mostly Agains and never
   reach the word-level reps floor. They join the Focus pool after
   problem words; a Focus test on an unsaved char grades its
   char-kind row, so progress clears it from the pool.
3. **Known-parts head start** (`knownPartsStability` in lib/fsrs.ts):
   a brand-new multi-char word whose every character (cascade-earned
   stability counts) sits at ≥ 7 days stability seeds with one damped
   cascade-style credit instead of due-now.
4. **Urgent-first ordering**: within each interleave group, words
   containing a problem character sort ahead of due-date order.

## Consequences

- One blamed character raises attention on every word sharing it —
  the error generalizes the way the confusion does.
- Words of well-known characters cost a few days less attention at
  the start; their first real grade takes over unchanged.
- Attribution Agains are real grades on char rows (as before, v57) —
  the thresholds keep a single mis-blame from mattering.
