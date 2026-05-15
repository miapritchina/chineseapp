# ADR-0004 — Cascade FSRS credit on Good/Easy only, never on Again

**Status:** Accepted · **Date:** 2025-Q4

## Context

When the user successfully recognizes a word, they've implicitly
recognized each constituent character. Crediting only the word would
under-schedule chars the user already knows.

When the user *fails* a word, attributing the failure is ambiguous —
which character threw them? Cascading Again across all components
would unfairly demote chars that may be fine.

## Decision

On Good/Easy of a *word*, `useReview.grade` walks the recursive
`componentClosure` and applies a **damped Good** to every
constituent char's `meaningRecognition` card:

- Stability is a 50/50 interpolation between previous and what a real
  Good would give.
- Due date pulled back proportionally.
- For never-direct-reviewed cards: cap at S = 7 days. A single word
  review cannot "graduate" an unseen char.
- `reps`, `lapses`, `last_review` are **not** bumped — this is not a
  direct review.

**Again does not cascade.** The user attributes the failure manually
via the "what threw you?" affordance (pick a constituent or skip).

## Consequences

- Chars get scheduled momentum from word reviews without inflating
  their review counts.
- The attribution UI is required — Again-with-no-attribution silently
  loses information. (It's still better than auto-cascade, which loses
  *more* information by penalizing the wrong items.)
