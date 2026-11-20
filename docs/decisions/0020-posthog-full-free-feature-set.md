# ADR-0020 — Use PostHog's full free feature set (personal project)

**Status:** Accepted · **Date:** 2026-11-20 · Amends the configuration in [ADR-0019](0019-measure-usage-before-reorganizing.md)

## Context
ADR-0019 started with named events + replay and autocapture off. The
owner also wants to learn PostHog itself, so she asked for every
feature the free tier offers. She has a work PostHog account too; this
app must use her **personal** project (US cloud).

## Decision
`lib/analytics.ts` initialises posthog-js 1.447 against the personal
project with: autocapture, hash-route `$pageview`/`$pageleave` (feeds
Web analytics and Paths), rage + dead clicks, heatmaps, exception
autocapture (+ React ErrorBoundary errors via `reportError`), web
vitals + network timing, session replay with console logs, and surveys.
Super properties `surface`, `app_version`, `standalone` ride on every
event so autocaptured clicks and heatmaps split by mode. Still
signed-in only, identified by Supabase user id, never email. Replay
does NOT record network headers/bodies (they carry the Supabase JWT).

## Consequences
- Replays include console output and unmasked inputs (search text) —
  acceptable for the owner's own sessions.
- Some features are switched on in the PostHog project settings, not
  in code (session replay, heatmaps toolbar URL, web vitals); without
  them the client data is captured but not shown.
- PostHog drops events from headless/automated browsers by design, so
  Playwright checks must opt out of the bot filter in the test only.
