# ADR-0001 — Supabase is the source of truth for user data

**Status:** Accepted · **Date:** 2025-Q3 (existing decision, recorded 2026-05-15)

## Context

Mobile-first web app, used in 3–7 minute sessions on iPhone Safari.
Safari ITP evicts `localStorage` after 7 days idle, so a pure-local
store loses user data the user actually cares about (saved words,
FSRS scheduler state, mnemonics, sentences).

## Decision

Supabase is authoritative for **every piece of user data** — saved
words, statuses, FSRS state, mnemonics, sentences (composer draft +
saved sentences). `localStorage` is permitted **only as an offline
read-cache**: hydrate on load for instant paint, then reconcile
against the DB with the DB winning.

Every new user-data feature ships with a Supabase table + RLS + sync
**from day one**. Do not merge a feature whose state lives only in
`localStorage`.

Public derivable data (dictionary rows, `data-chars.json`, stroke
data, the per-day new-card counter) may stay cached locally.

## Consequences

- Five user-data hooks (`useSaved`, `useReview`, `useMnemonics`,
  `useSentenceDraft`, `useSavedSentences`) hydrate from cache, then
  reconcile against Supabase on sign-in **and on every tab focus**
  (throttled ~20 s). DB wins per-key, newer-wins where a timestamp
  exists; FSRS uses more-reps-wins so a focus re-sync doesn't drop a
  just-graded card.
- Tables: `user_saves`, `user_fsrs_state`, `user_mnemonics`,
  `user_sentences` (PK `user_id,hanzi`), `user_sentence_draft` (one row
  per user).
- **Known limitation:** reconcile is union-with-remote-wins, so a
  *deletion* on another device does not propagate to a device that
  still has the item cached locally. Fixing this needs a tombstone
  column or a wholesale "replace local with remote on re-sync" pass.
  Acceptable for a single-user app; revisit if it bites.
