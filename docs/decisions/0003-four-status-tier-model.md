# ADR-0003 — Four mutually-exclusive status tiers, separate timestamp columns

**Status:** Accepted · **Date:** 2025-Q3

## Context

A saved item progresses through learning states. Modelling options:

1. A single `status` enum column.
2. Multiple boolean columns.
3. Multiple timestamp columns, one per tier.

## Decision

Four columns on `user_saves`, **one timestamp per tier**:

| Tier | Column | Saved? | Surfaces in review |
|---|---|---|---|
| ★ Saved | (`saved_at` — row presence) | yes | meaning + sound recognition |
| ❗ Need to learn | `review_at` | yes (auto) | same |
| 🎓 Learned | `learned_at` | yes (auto) | same |
| ✒ Wrote | `wrote_at` | yes (auto) | + production (Hanzi Writer trace) |

**Invariant** (client-enforced in `useSaved.setStatus`): at most one of
`{learned_at, wrote_at, review_at}` is non-null. Priority for
`getStatus(key)` is `wrote > learned > review > saved`.

The fourth-tier column is named `review_at` for historical reasons;
the UI label is "Need to learn".

## Consequences

- **Additive migrations:** adding a fifth tier (e.g. `mastered_at`)
  doesn't require an `ALTER TYPE`. Aligns with [ADR-0005](0005-additive-migrations-and-shape-fallback.md).
- Each tier carries its own timestamp for free — useful for stats.
- Rollback safety: a buggy client that sets two columns at once doesn't
  crash anything — priority lookup picks the highest.
- No DB constraint enforces the invariant. If we ever see drift,
  consider a CHECK constraint that allows at most one non-null.
