# ADR-0007 — Tap-anywhere-to-advance, no auto-advance timers

**Status:** Accepted · **Date:** 2025-Q4 (v63, v71, v75)

## Context

Drill cards initially advanced via small "Next" buttons and an
auto-advance timer. Both felt wrong: the button was a finicky tap
target, and the timer either rushed the user or felt like dead air.

## Decision

**All drill progression is user-initiated, never timer-driven.**
The whole card surface is tappable after grading; tap anywhere to
advance.

## Implementation contract for every drill component

- Mounted with `key={rid(current)}` so the card identity changes
  between queue items and React unmounts/remounts cleanly.
- Owns its own `picked` (or equivalent) state.
- Receives `onGrade(rating)` from the parent.
- Renders a small `.drill-skip` button at the bottom, visible **only
  before** the user answers.
- The tap-to-advance handler sits on the outer card surface that
  fills `.review-body`. Internal buttons stop event propagation
  **only when not yet `allGraded`**. Once both grades are picked,
  any click bubbles to the surface and fires advance.

Audio is opt-in and timed by role:
- PhoneticTap speaks the parent char on mount (parent is the prompt).
- ComponentSound + FamilyTransfer speak only **after** pick (playing
  it before would be the answer).
- Combined recognition speaks on reveal.

## Consequences

- New drill components must clone this contract. See `docs/architecture/ARCHITECTURE.md` → "Drill component contract".
- The v75 fix was a bug in this contract: grade buttons unconditionally
  stopped propagation and blocked the post-grade tap-anywhere. Audit
  any `stopPropagation` call you add.
- A "tap to continue" pulse hint used to sit on the drill surface. v150
  removed all on-surface instruction hints (they flickered on every
  reveal); per-drill instructions now live behind the header `?` popover
  (`DrillHelp`). The tap-anywhere-to-advance contract itself is unchanged.
