# ADR-0010 — Ref-mirrored cards map in `useReview`, not updater side-channels

**Status:** Accepted · **Date:** 2026-07-13 (v95)

## Context

ADR-0008 made every `useReview` mutation use functional setState so
two same-tick `grade()` calls (combined card: meaning + sound) don't
lose an update. But it smuggled the changed-rows list out of the
updater via a closed-over variable read synchronously after
`setCards()`. React only runs an updater eagerly when the fiber has no
pending update — true for the *first* dispatch in a tick, false for
the second. So the second grade's change-list was always empty at read
time: the sound facet's grade persisted locally but **never reached
the Supabase upsert**, silently violating ADR-0001 (Supabase is the
source of truth).

## Decision

`useReview` keeps a `useRef` mirror of the cards map. Every write goes
through one helper:

```ts
const applyCards = (next) => {
  cardsRef.current = next;   // synchronous — next caller sees it
  persistLocalCards(next);
  setCards(next);            // plain value, no updater side effects
};
```

`grade()` / `attributeFailure()` / reconcile compute `next` from
`cardsRef.current` synchronously, then call `applyCards` and upsert
the changed rows. Two grades in one tick chain correctly because the
second reads the first's result from the ref. Updater side effects are
gone entirely (StrictMode double-invoke is moot).

Additionally, cascade credit fires only on the **meaning** facet grade
— both facets cascading doubled the damped credit per combined review.

## Consequences

- Same-tick grades both persist locally **and** both upsert to
  Supabase.
- All card-map writers must use `applyCards`; a stray raw `setCards`
  would desync the ref. Cheap rule to keep in review.
- Supersedes ADR-0008's mechanism (its goal stands).
