# Supabase setup

Project: `https://oigbbgtzzqiceetasayy.supabase.co` (`oigbbgtzzqiceetasayy`).

## One-paste setup (mobile-friendly)

The workflow does everything (applies the schema, fetches the service_role
key, seeds 91k words, verifies) — it reads the Supabase PAT from a
**GitHub Environment secret** so you don't paste it each run. No SQL
editor. No terminal.

### 1. Generate a Supabase Personal Access Token (one time)

Open <https://supabase.com/dashboard/account/tokens>.
Click **Generate new token**, give it any name (e.g. `chinese-app-ci`),
copy the token. Rotate later by revoking and generating a new one.

### 2. Store it as an Environment secret (one time)

In GitHub: **Settings → Environments → `github-pages` → Environment
secrets → Add secret**. Name it **`supabaseapi`**, paste the token. (If
the `github-pages` environment doesn't exist yet, create it first — same
page.)

### 3. Run the workflow

Open `github.com/decobots/Ai-/actions`.

- Tap **Setup Supabase** → **Run workflow**.
- Leave the three checkboxes ticked.
- Tap **Run workflow**.

Takes ~2-3 min. The final step prints:

```
[
  { "words": 91508 },
  { "word": "好", "tier": 0, "rank": 10 },
  …
]
```

If you see a `words` count near 91 000, you're done. After this, **you
generally won't touch the workflow again** — see "Auto-trigger" below.

### Auto-trigger on new migrations

The workflow runs automatically on push to `claude/main` whenever a file
under `supabase/migrations/**` changes (i.e. you commit/merge a new
migration). It applies migrations + refreshes the auth redirect config,
and **skips the heavy seed step** (the `words` table is already
populated; seeding is idempotent but slow and uses API quota). If you
need to re-seed — e.g. after a `chinese-lexicon` update — use the manual
"Run workflow" path above with the **Upsert all ~91k words** box ticked.

### Rotating the PAT

Generate a fresh PAT at the same URL, update the `supabaseapi` secret
value, then revoke the old one.

## How it works

The workflow uses the Supabase Management API
(`https://api.supabase.com/v1/...`) with the PAT (read from the
`supabaseapi` Environment secret) as a Bearer token to:

1. Verify the PAT has access to the project.
2. `POST /projects/<ref>/database/query` with the contents of every file
   in `migrations/` (in numeric order) — applies the schema in one
   round-trip per file. All migrations are idempotent (`IF NOT EXISTS`,
   `DROP POLICY IF EXISTS` + recreate, etc.) so re-running is safe.
3. `GET /projects/<ref>/api-keys` — fetches the `service_role` key (used
   only inside the runner, masked in logs, never written to disk).
4. Run `node scripts/seed-supabase.mjs` with that key — batched upserts,
   idempotent on the `word` PK.
5. `POST /projects/<ref>/database/query` again to verify counts.

The PAT is held by GitHub as an encrypted Environment secret (only
readable to runs of this workflow when gated by the `github-pages`
environment) and is auto-masked in logs. Nothing about your project leaves
the GitHub Actions runner. The service_role key is fetched fresh each
run; it's never persisted.

Because the job is gated by `environment: github-pages`, the workflow can
only be dispatched from a branch the environment's deployment-branches
rule allows (typically the default branch).

## Schema overview

| Migration | Adds |
|---|---|
| `0001_dictionary.sql` | `words` table + indexes + `search_words(text)` RPC |
| `0002_user_saves.sql` | `user_saves(user_id, word, saved_at)` + RLS |
| `0003_user_saves_learned.sql` | `learned_at` column |
| `0004_search_words_rich.sql` | widens `search_words` return shape |
| `0005_user_saves_wrote.sql` | `wrote_at` column |
| `0006_user_saves_review.sql` | `review_at` column ("Need to learn" tier) |
| `0007_fsrs_state.sql` | `user_fsrs_state(user_id, item_key, item_kind, facet, card jsonb, due_at, last_review_at)` for the SRS scheduler |
| `0008_user_mnemonics.sql` | `user_mnemonics(user_id, key, text, edited, updated_at)` — per-key "make it stick" notes |
| `0009_user_sentences.sql` | `user_sentences(user_id, hanzi, keys jsonb, pinyin, created_at)` (saved sentences, PK user_id+hanzi) + `user_sentence_draft(user_id, keys jsonb, updated_at)` (one in-progress composer draft per user) |

`user_saves` enforces "at most one of `{learned_at, wrote_at, review_at}`
non-null at a time" by client convention (no DB constraint) — that's how
the four-status model is encoded.

`user_fsrs_state` stores one ts-fsrs Card per `(item, facet)` tuple.
`item_kind` is `word | char | component`; `facet` is `recognition |
phoneticTap | componentSound | familyTransfer | production`. Adding a
new facet doesn't need a migration.

After applying a new migration, the front-end keeps working — sync
queries that reference a missing column are wrapped in try/fallback
paths that downgrade to the older shape silently.

## Local-developer path (alternate)

If you ever want to seed from a laptop instead of CI:

```sh
# Apply schema
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_dictionary.sql

# Seed
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/seed-supabase.mjs
```

`$SUPABASE_DB_URL` should be the **Session pooler** URL (port 5432, host
`*.pooler.supabase.com`), not the direct one — Supabase free tier doesn't
expose IPv4 on direct.

## Verifying via SQL

In the SQL Editor (or via psql):

```sql
SELECT count(*) FROM words;             -- ~91 000
SELECT * FROM search_words('hao');      -- top 30 by tier + rank
SELECT * FROM search_words('胡萝卜');    -- exact match, tier 0
```

## Rotating the publishable key

The app's anon (publishable) key is hard-coded in `src/lib/supabase.ts` and
is intentionally public — RLS gates everything. If you ever rotate it,
update that file and the constant in `scripts/seed-supabase.mjs`.
