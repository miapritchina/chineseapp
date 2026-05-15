# ADR-0002 — Disable FSRS short-term learning steps

**Status:** Accepted · **Date:** 2025-Q4

## Context

`ts-fsrs` ships intraday "learning steps" (`["1m","10m"]`) **on by
default**. A brand-new card graded Good only moves ~10 minutes into
the future and needs a *second* Good (or one Easy) to graduate to a
real multi-day interval.

For a review-once-a-day app, that reads as "I reviewed this and it
came right back" — the schedule looks broken.

## Decision

Set `enable_short_term: false` in the FSRS config wrapper
(`src/lib/fsrs.ts`). FSRS-6 scheduler, retention target 0.9, otherwise
default parameters until the user has ~1000 reviews (then the optional
`@open-spaced-repetition/binding` package can re-train).

## Consequences

- First Good schedules straight from initial stability (~3 days).
- Again still recurs quickly (same-day / next-day).
- Existing cards stuck in a Learning state graduate automatically on
  their next grade — no migration.
- Pinned by `scripts/test-fsrs.mjs` ("a brand-new card graded Good is
  due at least a day out").
