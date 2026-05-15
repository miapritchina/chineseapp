# ADR-0009 — Char data ships static; word data lives in the DB

**Status:** Accepted · **Date:** 2025-Q3

## Context

Two big static reference datasets back the app:
- ~10k characters with components and etymology (548 KB gzipped)
- ~91k words with pinyin, definitions, HSK, rank (3.9 MB gzipped)

Both could ship as static JSON, or both could live in Supabase, or
split.

## Decision

**Chars ship as a static file** (`public/data-chars.json`).
**Words live in Supabase** (`words` table, queried via `search_words`
RPC).

## Rationale

- The decomposition tree walks `chars` recursively to depth 5.
  Batching depth-N fetches over HTTP for every tree open is a latency
  cliff for zero real win — and a tree opens on every entity tap.
- The full word set at 3.9 MB gzipped is too heavy for mobile
  first-load. One-keystroke debounced search fetches are tolerable
  and let the server do tiered ranking that would be expensive to
  port to JS.

## Consequences

- Updating chars or phonetic-components means regenerating the static
  files and committing them (`extract-chinese.mjs`,
  `extract-phonetic-components.mjs`).
- Updating words means re-seeding Supabase via `seed-supabase.mjs`
  with the service-role key (out-of-band, manual).
- The network/components views read from `localStorage` directly and
  don't talk to Supabase. That's a simplification choice — they're
  part of the same app but the current static-HTML implementation
  keeps them lean. Migrating them to read from Supabase (or porting
  them to React routes) is a future option.
