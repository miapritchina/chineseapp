# ADR-0014 — No same-day retry after Again

**Status:** Accepted · **Date:** 2026-07-20 (v112)

## Context

ADR-0012 point 2 ("repeat until correct") re-queued an Again-graded
card at the end of the same session and kept it returning until
answered without Again. Living with it, the owner found immediate
retries worthless — the answer is still in short-term memory, so the
retry tests nothing — and asked that a missed card not reappear the
same day.

## Decision

Remove the in-session retry machinery entirely (retry copies,
attempt-keyed remounts). A wrong answer is recorded once and the card
leaves the session; FSRS handles the comeback — with
`enable_short_term: false` (ADR-0002) an Again lands due exactly 24
hours out, for new and mature cards alike, so the retry happens
tomorrow by construction.

## Consequences

- A session's card count no longer inflates mid-session after
  mistakes; progress counts monotonically to the chosen size.
- BUG-18's attempt-keyed remount fix becomes moot (a rid can no
  longer resurface within a session) and was removed with it.
- Supersedes the repeat-until-correct half of ADR-0012; its no-cap
  half and the one-grade→two-grade evolution (ADR-0013) stand.
