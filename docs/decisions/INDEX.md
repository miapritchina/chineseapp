# Architecture Decision Records

Each ADR captures one decision: the context that forced the choice,
the choice itself, and the consequences we accept by making it.

Numbering is sequential and **immutable** — once assigned, an ADR
number never changes, even if the ADR is superseded.

## Index

| # | Title | Status |
|---|---|---|
| 0001 | [Supabase is the source of truth for user data](0001-supabase-source-of-truth.md) | Accepted |
| 0002 | [Disable FSRS short-term learning steps](0002-fsrs-short-term-steps-disabled.md) | Accepted |
| 0003 | [Four-status tier model with per-tier timestamps](0003-four-status-tier-model.md) | Superseded by ADR-0011 |
| 0004 | [Cascade FSRS credit on Good/Easy only, not Again](0004-cascade-credit-on-good-not-again.md) | Accepted |
| 0005 | [Additive-only migrations; widest-shape-first queries](0005-additive-migrations-and-shape-fallback.md) | Accepted |
| 0006 | [Daily new-card cap (25) + active leech interleaving](0006-daily-cap-and-leech-interleave.md) | Cap superseded by ADR-0012; leech half stands |
| 0007 | [Tap-anywhere-to-advance, no auto-advance timers](0007-tap-anywhere-to-advance.md) | Accepted |
| 0008 | [Functional setState in `useReview` for concurrent grades](0008-functional-setstate-for-concurrent-grade.md) | Superseded by ADR-0010 |
| 0009 | [Char data static, word data in DB](0009-chars-static-words-in-db.md) | Accepted |
| 0010 | [Ref-mirrored cards map in `useReview`](0010-ref-mirrored-cards-map-in-usereview.md) | Accepted |
| 0011 | [Two-tier status model (Saved / Learned)](0011-two-tier-status-model.md) | Accepted |
| 0012 | [No daily cap; repeat-until-correct; one grade per card](0012-no-daily-cap-repeat-until-correct.md) | Only the no-cap half stands (one-grade → ADR-0013, retry → ADR-0014) |
| 0013 | [Separate meaning + sound grades on the one recognition card](0013-split-meaning-sound-grades-on-one-card.md) | Accepted |
| 0014 | [No same-day retry after Again](0014-no-same-day-retry.md) | Accepted (Focus mode excepted — ADR-0015) |
| 0015 | [Focus mode repeats problem words within one session](0015-focus-mode-same-session-repetition.md) | Accepted |

## Writing a new ADR

Format:

```markdown
# ADR-NNNN — Short imperative title

**Status:** Proposed | Accepted | Superseded by ADR-XXXX · **Date:** YYYY-MM-DD

## Context
What forced the decision? Constraints, prior pain, alternatives considered.

## Decision
The choice, stated plainly. Code-level specifics if helpful.

## Consequences
What we now have to live with — both wins and costs.
```

Keep it short. If a decision needs more than a screen, the ADR is too
broad; split it.
