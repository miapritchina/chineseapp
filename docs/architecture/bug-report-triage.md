# In-app bug reports — how they reach you and how to triage them

The app's **Report a bug** button (the 🐞 icon in every surface's top bar)
lets a user type what went wrong; the app auto-captures where they were. This
doc is the runbook for **finding and acting on those reports.**

## TL;DR for a future chat

**Bug reports arrive as GitHub issues labeled `bug-report`.** To see them:

- List them: `list_issues` with `labels: ["bug-report"]` (GitHub MCP), or
  `search_issues` `repo:miapritchina/chineseapp label:bug-report state:open`.
- Want the latest first? A report may still be sitting in Supabase waiting for
  the next sync (every 30 min). To pull them **now**, trigger the
  **`Bug reports → Issues`** workflow (`actions_run_trigger` /
  workflow_dispatch), wait for it, then re-list the issues.

Each issue's body has the reporter's note plus a context table (page, active
word/char, build version, viewport, device, timestamp). That's usually enough
to reproduce without a screenshot.

---

## The pipeline (why it's shaped this way)

The app is a static PWA on GitHub Pages — its JS bundle is public, so it
**cannot hold a GitHub token** to open issues directly. So reports take two
hops:

```
🐞 in the app
   └─ INSERT into Supabase bug_reports   (the only thing a public client can reach securely)
        └─ GitHub Action: bug-reports-to-issues.yml   (holds the Supabase PAT; runs every 30 min + on demand)
             └─ opens a GitHub issue labeled `bug-report`, then stamps the row with the issue number
```

- **Supabase `bug_reports`** is the durable inbox and the source of truth
  (ADR-0001). Table: migrations `0016_bug_reports.sql` +
  `0017_bug_reports_github_issue.sql`. RLS makes `SELECT` owner-only, so the
  app's anon key can only INSERT — you can't read this table from a normal
  session (see "Reading Supabase directly" below).
- **The Action** ([`.github/workflows/bug-reports-to-issues.yml`](../../.github/workflows/bug-reports-to-issues.yml)
  → [`scripts/sync-bug-reports.mjs`](../../scripts/sync-bug-reports.mjs)) is the
  bridge. It reads/marks rows via the Supabase **Management API** using the
  same `supabaseapi` PAT that Setup Supabase uses (a `github-pages` environment
  secret), and files issues with the workflow's built-in `GITHUB_TOKEN`. It's
  idempotent: only rows with `github_issue IS NULL` become issues, and each row
  is stamped `github_issue` + `synced_at`, so nothing is filed twice.
- **GitHub issues** are the readable, triageable copy — the thing you work
  with.

### One-time setup (owner)

GitHub **Issues must be enabled**: Settings → General → Features → **Issues**.
Until then the Action no-ops with a warning (it can't file into a disabled
tracker). Nothing else — the Supabase PAT and the columns are already wired,
and the migration applies itself via Setup Supabase on merge.

---

## Triage workflow — from an issue to a fix

1. **List** open `bug-report` issues (or run the sync first for anything
   fresh).
2. **Reproduce** from the issue's context table: go to `Route`/`Page`, open the
   `Word / char`, note the build `Version` and device.
3. **Decide:**
   - Real defect → fix it on a branch like any other bug (tests + version bump
     + CHANGELOG). Reference the issue (`fixes #N`) in the PR. If it's worth
     tracking long-term, also give it a `BUG-NNN` row in `BUGS.md`; for small
     one-shot fixes the issue itself is enough.
   - Duplicate / already fixed → comment and close, pointing at the original.
   - Not-a-bug / can't-repro → comment why and close.
4. **Close the issue** when done. The issue's open/closed state *is* the triage
   state — you don't need to write anything back to Supabase (the row keeps its
   `github_issue` link for provenance).

> Every issue comment you post must end with the Claude Code attribution
> footer (see the repo's GitHub posting rules).

---

## Reading Supabase directly (rarely needed)

You normally never touch Supabase — read the issues. But if you need the raw
table (e.g. to debug the sync, or a report that failed to file):

- **Owner, dashboard:** SQL editor at
  `https://app.supabase.com/project/oigbbgtzzqiceetasayy/sql/new`:

  ```sql
  select created_at, github_issue, note, context ->> 'version' as version
  from bug_reports order by created_at desc limit 50;

  -- reports that haven't been turned into an issue yet
  select * from bug_reports where github_issue is null order by created_at;
  ```

- **From a session:** you can't — SELECT is owner-only and no service-role /
  Management key is in the environment. Trigger the sync workflow and read the
  resulting issues instead, or ask the owner to paste rows.

Row shape (`context` JSONB written by [`src/lib/bugReport.ts`](../../src/lib/bugReport.ts)):
`page`, `hash`, `entity` (`word:…`/`char:…`), `version`, `userAgent`,
`viewport`, `language`, `standalone` (installed PWA), `online`, `timestamp`;
plus columns `id`, `user_id` (null = anonymous reporter), `note`, `created_at`,
`github_issue`, `synced_at`.
