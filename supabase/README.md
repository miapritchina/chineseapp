# Supabase setup

Project: `https://oigbbgtzzqiceetasayy.supabase.co` (`oigbbgtzzqiceetasayy`).

## One-paste setup (mobile-friendly)

You hand over **one token, one time**, and the workflow does everything else
(applies the schema, fetches the service_role key, seeds 91k words, verifies).
No repo secrets to configure. No SQL editor. No terminal.

### 1. Generate a Supabase Personal Access Token

Open <https://supabase.com/dashboard/account/tokens> on your phone.
Click **Generate new token**, give it any name (e.g. `chinese-app-seed`),
copy the token.

The token is sensitive but **temporary** — you can revoke it the moment the
workflow finishes.

### 2. Run the workflow

Open `github.com/decobots/Ai-/actions` on your phone.

- Tap **Seed Supabase Dictionary** → **Run workflow**.
- Paste the PAT into the **Supabase Personal Access Token** field.
- Leave the two checkboxes ticked.
- Tap **Run workflow**.

Takes ~2-3 min. The final step prints:

```
[
  { "words": 91508 },
  { "word": "好", "tier": 0, "rank": 10 },
  …
]
```

If you see a `words` count near 91 000, you're done.

### 3. Revoke the PAT (optional but recommended)

Back at <https://supabase.com/dashboard/account/tokens>, revoke the token you
just created. The seed already ran; you don't need it again unless you want
to re-seed (e.g. after a `chinese-lexicon` update). If you do, generate a
fresh token then.

## How it works

The workflow uses the Supabase Management API
(`https://api.supabase.com/v1/...`) with your PAT as a Bearer token to:

1. Verify the PAT has access to the project.
2. `POST /projects/<ref>/database/query` with the contents of
   `migrations/0001_dictionary.sql` — applies the schema in one round-trip.
3. `GET /projects/<ref>/api-keys` — fetches the `service_role` key (used
   only inside the runner, masked in logs, never stored anywhere).
4. Run `node scripts/seed-supabase.mjs` with that key — batched upserts,
   idempotent on the `word` PK.
5. `POST /projects/<ref>/database/query` again to verify counts.

Nothing about your project leaves the GitHub Actions runner. The PAT exists
only as the workflow's input value (auto-masked in logs, never written to
disk, gone the moment the run finishes).

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
