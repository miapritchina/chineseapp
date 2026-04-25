# Supabase setup

Project: `https://oigbbgtzzqiceetasayy.supabase.co` (`oigbbgtzzqiceetasayy`).

## One-time: apply the dictionary schema

Two ways:

### A — Dashboard SQL Editor (no CLI needed)

1. Open the project's SQL Editor:
   <https://app.supabase.com/project/oigbbgtzzqiceetasayy/sql>
2. Paste the entire contents of `migrations/0001_dictionary.sql` and run.

### B — Supabase CLI

```sh
supabase link --project-ref oigbbgtzzqiceetasayy
supabase db push
```

Verify in the Table Editor that `words` exists with the indexes and that the
`search_words(text)` function appears under Database → Functions.

## One-time: seed the dictionary (~91k rows)

Get the **service_role** key (NOT the publishable key) from
<https://app.supabase.com/project/oigbbgtzzqiceetasayy/settings/api-keys>.
Treat it like a password — never commit it.

```sh
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/seed-supabase.mjs
```

Takes ~1-2 min on a decent connection. Tail of the run reports the upserted
count and a sample row (`你好`).

Re-run safely whenever `chinese-lexicon` updates — the script upserts on the
`word` PK.

## Verifying

In the SQL Editor:

```sql
SELECT count(*) FROM words;            -- ~91 000
SELECT * FROM search_words('hao');     -- top 30 matches by tier+rank
SELECT * FROM search_words('胡萝卜');   -- exact-match tier 0
```

## Re-deploy

GitHub Pages picks up new builds automatically; nothing extra to do. The app's
anon key is hard-coded in `src/lib/supabase.ts` and is intentionally public —
RLS gates everything. If you ever rotate the publishable key, update that file
and any hardcoded references in `scripts/seed-supabase.mjs`.
