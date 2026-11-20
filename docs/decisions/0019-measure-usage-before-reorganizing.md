# ADR-0019 — Measure real usage with PostHog before reorganizing practice

**Status:** Accepted · **Date:** 2026-11-20

## Context
The app grew to ~20 ways to start practicing (Review + 5 drill
toggles, Just start, Flashcards, Learn, Sift, Focus, 5 games, Explore,
三字经, Sentence Studio). The owner opens it less than expected and
feels overwhelmed: too many choices, backlog pressure, unclear payoff.
Hello Chinese already owns her daily streak. Only graded reviews were
logged (`user_review_log`); which surfaces she opens, quits, or never
touches was unknown.

Owner's baseline guesses (2026-11-20), to compare against the data:
opens the app **1–2× a week**; uses **search/save** and **games** most;
comes to look up/save a word or when bored.

## Decision
- Instrument with **PostHog** (named events + session replay), signed-in
  sessions only, identified by the Supabase user id — never email.
  Events: `app_open`, `surface_view` / `surface_leave` (every mode and
  game is its own surface, `activeSurface` in `lib/analytics.ts`),
  `card_done`, `search`, `entity_open`, `word_status`. Autocapture off.
- Run for ~3 weeks, then compare with the baseline above and do the
  agreed **two-door reorganization** (TODO P1): home = search/save +
  one "▶ 5 minutes" button (absorbs Review, Just start, Flashcards,
  Focus, Learn) + a Play row trimmed to ~3 games by the data.
- Meanwhile remove the pressure signals now (owner picked "quick fixes
  + measure"): no due badge, no daily-goal counter, no backlog counts
  on the review launcher. The portal complements Hello Chinese — no
  streak or quota of its own.

## Consequences
- The data measures the de-pressured UI, not the original; accepted.
- A third party (PostHog) receives usage events and session replays of
  the owner's own sessions. Not user data in the ADR-0001 sense — no
  app state depends on it, nothing is read back.
- The project key ships in the bundle (public by design); an empty key
  turns analytics off. posthog-js is a lazy chunk, so first paint is
  unaffected.
