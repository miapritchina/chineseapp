# ADR-0011 — Collapse to a two-tier status model (Saved / Learned)

**Status:** Accepted · **Date:** 2026-07-13 (v99)

## Context

ADR-0003 defined four tiers (★ Saved / ❗ Need to learn / 🎓 Learned /
✒ Wrote). In practice the owner uses two: "Need to learn" duplicated
what the SRS schedule already expresses (due cards ARE the
need-to-learn set), and "Wrote" was a manual claim the production
drill tests better than a self-assigned badge.

## Decision

The UI offers **Saved** and **Learned** only. The data model does not
change (additive policy, ADR-0005): `review_at` / `wrote_at` columns
and their localStorage mirrors stay, keep syncing, and legacy rows map
on read — wrote → Learned, review → Saved. The `Status` type keeps all
four members for that mapping.

Knock-on: the production (trace) drill was gated on ✒ Wrote; it now
seeds for every saved single character (still an opt-in launch
toggle). The graph pages fold the wrote tier into learned.

## Consequences

- One decision per word ("do I know this?") instead of a taxonomy.
- No data loss; the tiers can return by reverting the read-mapping.
- Supersedes ADR-0003.
