# ADR-0006 — Daily new-card cap (25) and active leech interleaving

**Status:** Accepted · **Date:** 2025-Q4

## Context

Without intervention an enthusiastic save spree dumps hundreds of new
cards into the queue at once, and confusable items (e.g. 易/昜, 未/末)
churn indefinitely as the user keeps mixing them up.

## Decision

**Daily new cards cap = 25.** Tracked in `localStorage` as
`{ date, ids[] }`; resets when the date rolls. Once 25 new cards have
been seeded today, further new cards drop out of the visible queue
until tomorrow.

**Active leech interleave.** When a card surfaces with
`card.lapses >= 6` AND its key is in `CONFUSION_CLUSTERS`
(`src/lib/confusionClusters.mjs`), the `DisambiguationCard` paints
once that session, and the *other* cluster members get force-surfaced
(pulled from the full `cards` map even if not currently due) so the
user contrasts them back-to-back.

## Consequences

- The cap is local-only — switching devices on the same day resets it.
  Acceptable.
- Clusters are hand-curated, not derived from lapse co-occurrence.
  Adding to them is a code change.
- The cap implementation lives in `dueCards` (a `useMemo` in
  `useReview`). Hot path; keep cheap.
