# ADR-0017 — Flashcards is a derived view, not a new data feature

**Status:** Accepted · **Date:** 2026-08-24

## Context

The owner originally rejected flashcards, then reversed: a
low-pressure way to *look* at saved words — flip to see pinyin +
meaning, no obligation to grade — is valuable. The reason plain
flashcards failed the first time was ordering: they surfaced
well-known words and got boring.

The data-persistence policy ([ADR-0001](0001-supabase-source-of-truth.md),
CLAUDE.md) says every new user-data feature ships with a Supabase
table + RLS from day one. Taken literally that would demand a table
for flashcards. But flashcards introduce no state of their own: the
deck is derived from saved words + FSRS rows, and any learning signal
belongs in the existing FSRS state.

## Decision

Ship Flashcards (`FlashcardsPage`, `#/cards`) as a **derived view over
existing state** — no new table, no new persisted field.

- Deck order (`lib/flashcards.ts`, pure + unit-tested): everything due
  now weakest-first, then the weakest not-yet-due words as filler,
  dropping the well-mastered (min recognition stability ≥
  `FLASHCARD_MASTERED_STABILITY_DAYS`, 21d). This is the spaced-
  repetition answer to the "boring known words" complaint.
- Optional per-card rating routes through the normal `grade` path,
  writing the word's `meaningRecognition` + `soundRecognition` rows
  (cascade included) — the same rows Review writes.
- Advancing without rating applies the existing passive-view credit
  (`creditPassiveView`), the same nudge opening a sheet gives.

## Consequences

- No migration, no RLS, no sync code — the feature is state-free and
  can't drift from the source of truth, because it has none of its own.
- The persistence policy is unbothered: it governs features that *hold*
  user data. A view that only reads existing data and writes through
  established, already-synced paths is out of its scope. Future
  features should apply the same test before assuming they need a table.
- If flashcards ever grow their own state (a "seen today" list, a
  per-deck setting), that state falls back under ADR-0001 and needs a
  table then.
