# ADR-0008 — Functional setState in useReview to survive concurrent grades

**Status:** Accepted · **Date:** 2025-Q4 (v76)

## Context

The combined recognition card grades meaning **and** sound back-to-back
when the user taps to advance — two `grade()` calls in the same tick.

Pre-v76, `useReview.grade` captured `cards` in its `useCallback`
closure and ran `setCards(next)` synchronously. Both calls saw the
same stale `cards` snapshot; the second call's `setCards` overwrote
the first's update. One of the two facet grades silently disappeared.

User reported the symptom as "post-grade tap-anywhere does nothing."

## Decision

**Every state mutation in `useReview` uses the functional setState
form** so each invocation sees the latest state:

```ts
let changedRows: ReviewCard[] = [];
setCards((prev) => {
  // mutate based on `prev`, not on a closed-over `cards`
  changedRows = [...];   // re-assigned every invocation so StrictMode
  return next;           //   double-invoke doesn't duplicate the
});                      //   remote upsert
if (changedRows.length) remoteUpsert(changedRows);
```

## Consequences

- Any new mutation method added to `useReview` **must** clone this
  pattern. Adding one that uses the closed-over `cards` is a bug.
- The `changedRows` reassignment inside the updater is intentional —
  it deduplicates StrictMode's double-invoke.
- Generalizes to any hook that may receive multiple synchronous calls
  in one tick.
