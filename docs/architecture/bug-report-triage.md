# In-app bug reports — where they live and how to triage them

The app's **Report a bug** button (the SVG bug icon in every surface's
top bar) writes one row to the Supabase `bug_reports` table per report.
This is the replacement for "the owner sends a screenshot." This doc is
the runbook for **finding and acting on those reports** — read it before
you go looking for "the reported bugs."

`BUGS.md` is still the tracker of record. A `bug_reports` row is a raw
inbox item; triaging it means turning it into a `BUG-NNN` in `BUGS.md`
(or discarding it). See **Workflow** below.

---

## Where the reports are

- **Project:** Supabase `oigbbgtzzqiceetasayy`
  (`https://oigbbgtzzqiceetasayy.supabase.co`).
- **Table:** `bug_reports` — migration
  [`supabase/migrations/0016_bug_reports.sql`](../../supabase/migrations/0016_bug_reports.sql).
- **Dashboard:**
  `https://app.supabase.com/project/oigbbgtzzqiceetasayy/editor` (Table
  editor) or `.../sql/new` (SQL editor).

Row shape (the client writer is [`src/lib/bugReport.ts`](../../src/lib/bugReport.ts)):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` \| null | null when the reporter wasn't signed in (anon reports are allowed on purpose). `ON DELETE SET NULL`. |
| `note` | `text` | the free-text the reporter typed |
| `context` | `jsonb` | auto-captured, see below |
| `created_at` | `timestamptz` | indexed `DESC` |

`context` (JSONB) keys — the whole point is to reproduce without a
screenshot:

| Key | Example | Meaning |
|---|---|---|
| `page` | `"Word sheet"` | human label of the surface |
| `hash` | `"#/review"` | exact route |
| `entity` | `"word:你好"` \| `"char:好"` \| null | the active word/char, if any |
| `version` | `"chinese v147"` | build the report came from |
| `userAgent` | `"Mozilla/5.0 (iPhone…)"` | device/browser |
| `viewport` | `"390×844"` | CSS px |
| `language` | `"en-US"` | |
| `standalone` | `true` | running as an installed PWA (iOS home-screen) |
| `online` | `true` | navigator.onLine at report time |
| `timestamp` | ISO string | client clock (may differ from `created_at`) |

---

## Reading them — access reality (read this first)

**SELECT on `bug_reports` is owner-only** (RLS policy `"owner read"`:
`auth.uid() = user_id`). Consequences:

- The **embedded anon key** in the client bundle **cannot read the
  table at all** — it can only INSERT. So a script using
  `src/lib/supabase.ts` will get zero rows.
- Even the owner, signed in **through the app**, only sees their **own**
  reports (`user_id = them`), never the anonymous ones or another user's.
- **Reading the full inbox requires the `service_role` key**, which
  bypasses RLS. That key is a secret — it is **not** in this repo, not
  in the client bundle, and **not present in a normal Claude session's
  environment.**

**So, as a Claude session working this codebase, you almost certainly
cannot read the reports yourself.** Do not pretend you did. Instead, do
one of:

1. **Ask the owner to paste rows** from the dashboard (query below), or
2. Proceed only if the owner has **explicitly provided a service-role
   key** for this session via env (`SUPABASE_SERVICE_ROLE_KEY`). Never
   ask them to commit it; never write it to a file.

### Owner path — Supabase dashboard (fastest)

SQL editor → paste:

```sql
-- Most recent reports, newest first.
select
  created_at,
  coalesce(user_id::text, 'anon')       as reporter,
  note,
  context ->> 'page'    as page,
  context ->> 'entity'  as entity,
  context ->> 'version' as version,
  context ->> 'viewport' as viewport,
  context ->> 'userAgent' as ua
from bug_reports
order by created_at desc
limit 50;
```

Useful filters:

```sql
-- Only reports from a given build.
select created_at, note, context ->> 'page' as page
from bug_reports
where context ->> 'version' = 'chinese v147'
order by created_at desc;

-- Reports since a date (e.g. triage everything new this week).
select created_at, note, context
from bug_reports
where created_at >= '2026-08-01'
order by created_at desc;
```

### Service-role path — only when the owner supplied the key

If (and only if) `SUPABASE_SERVICE_ROLE_KEY` is in the environment,
a throwaway script can read the table. Mirror the seed script's pattern
([`scripts/seed-supabase.mjs`](../../scripts/seed-supabase.mjs)):

```js
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL || "https://oigbbgtzzqiceetasayy.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // secret; never commit
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db
  .from("bug_reports")
  .select("created_at,user_id,note,context")
  .order("created_at", { ascending: false })
  .limit(50);
console.log(error ?? data);
```

The service-role key bypasses RLS — treat it like a password. It never
belongs in a commit, a log, or a comment.

---

## Workflow — from a report to a fix

Reports are **append-only**: there is no `status`/`resolved` column, and
the client can't UPDATE or DELETE. So **triage state lives in `BUGS.md`,
not in the table.** Don't try to mark a row done in Supabase.

1. **Read** the inbox (owner pastes rows, or service-role script).
2. **Reproduce** using `context`: go to `hash` / `page`, open `entity`,
   note the `version` and device (`userAgent`, `viewport`, `standalone`).
3. **Decide:**
   - Real defect → **file it in `BUGS.md`** with a fresh `BUG-NNN`
     (lowest severity that fits; owner re-prioritizes). Put the reporter's
     `note` and the key `context` fields in the details. Then fix it on a
     branch like any other bug (tests + version bump + CHANGELOG).
   - Duplicate of an open `BUG-NNN` → mention it there, no new ID.
   - Not-a-bug / can't-repro → note it under **Withdrawn / not-a-bug** in
     `BUGS.md` so the same report doesn't get re-triaged next time.
4. Because there's no dedupe key back to the row, **record which reports
   you've triaged** in your reply to the owner (e.g. "triaged the 3
   reports from v147, filed BUG-20 and BUG-21, the third was a dupe of
   BUG-4"). The owner can then clear old rows from the dashboard if they
   want (a maintenance-only DELETE, done by them, not the app).

If the table is genuinely unreachable this session (no service-role key,
owner not around to paste), say so plainly and stop — don't guess at what
users reported.
