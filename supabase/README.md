# Supabase setup

Project: `https://oigbbgtzzqiceetasayy.supabase.co` (`oigbbgtzzqiceetasayy`).

## Mobile-friendly path (recommended)

Everything below can be done from a phone browser using the GitHub mobile UI
and the Supabase web dashboard. No SQL editor or local Node setup required.

### 1. Get the two values you'll need

From <https://app.supabase.com/project/oigbbgtzzqiceetasayy/settings/api-keys>
copy the **service_role** key (the one labeled "secret" — NOT the publishable
key already wired into the app).

From <https://app.supabase.com/project/oigbbgtzzqiceetasayy/settings/database>
under "Connection string", choose **URI**, reveal the password, and copy the
full string — it looks like:

```
postgresql://postgres:YOUR_PASSWORD@db.oigbbgtzzqiceetasayy.supabase.co:5432/postgres
```

Make sure `YOUR_PASSWORD` has been substituted in (the dashboard does this for
you when you reveal it; double-check there's no `[YOUR-PASSWORD]` placeholder
left).

### 2. Add both as repo secrets

In the GitHub mobile UI:

- Open the repo → **Settings** → **Secrets and variables** → **Actions**
- **New repository secret** twice:
  - Name `SUPABASE_DB_URL`, value = the full connection string from step 1.
  - Name `SUPABASE_SERVICE_ROLE_KEY`, value = the service_role key from step 1.

### 3. Run the workflow

In the same repo on mobile:

- **Actions** tab → **Seed Supabase Dictionary** → **Run workflow**
- Leave both checkboxes ticked (apply migration + run seed)
- Tap **Run workflow**

It takes ~2-3 min total. The workflow's last step prints a `count(*)` of the
`words` table (~91 000) and a sample of `search_words('hao')`. If those look
sane, you're done.

The workflow is idempotent — re-run it any time `chinese-lexicon` updates or
to repair a partial run.

## Local-developer path (alternate)

If you have psql + Node on your machine instead:

```sh
# Apply schema (idempotent)
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_dictionary.sql

# Seed
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/seed-supabase.mjs
```

## Verifying

In the SQL Editor (web) or psql:

```sql
SELECT count(*) FROM words;             -- ~91 000
SELECT * FROM search_words('hao');      -- top 30 by tier + rank
SELECT * FROM search_words('胡萝卜');    -- exact-match tier 0
```

## Re-deploy

GitHub Pages picks up new builds automatically; nothing extra to do once the
seed has run. The app's anon (publishable) key is hard-coded in
`src/lib/supabase.ts` and is intentionally public — RLS gates everything. If
you ever rotate the publishable key, update that file and any hardcoded
references in `scripts/seed-supabase.mjs`.
