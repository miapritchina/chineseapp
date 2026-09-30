# ADR-0018 — Ship pre-generated mnemonic seeds, not a live LLM call

**Status:** Accepted · **Date:** 2026-09-30

## Context

The owner struggles to remember characters and wants story mnemonics.
Research found no open mnemonics dataset or API for Chinese — HanziHero,
Pandanese, Heisig and Chineasy are all proprietary; makemeahanzi /
chinese-lexicon carry only etymology hints (already shipped). The
practical source is LLM generation from the decomposition data the app
already has. A live call needs somewhere to hold an API key (the app is
static GitHub Pages + Supabase), owner-funded billing, and fails
offline.

## Decision

Generate the mnemonics ahead of time and ship them as static data:
`public/mnemonic-seeds.json`, 655 hand-written stories covering the
official HSK 3.0 level 1–3 character set (matches the HelloChinese v2
course band the owner studies). Style: 1–2 sentence visual scene from
the character's components; a pronunciation cue only where a sound
component genuinely matches. `MnemonicSection` prefers the seed over
the formulaic starter; user edits override via `user_mnemonics` as
before. Seeds are public derivable data — no Supabase table, cached
like `data-chars.json`.

On-demand generation for characters outside the set stays a tracked
follow-up (Supabase Edge Function holding an Anthropic key), not part
of this change.

## Consequences

- Zero runtime cost, works offline, no key management; +77 KB static.
- Characters beyond HSK 3.0 level 3 fall back to the old formulaic
  starter until the set is extended (another batch or the edge
  function).
- The seed file's contract (single known chars, non-empty, ≤400 chars,
  ≥600 entries) is enforced by `scripts/test-mnemonics.mjs`.
