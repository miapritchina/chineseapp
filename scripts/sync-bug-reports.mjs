// Turn Supabase `bug_reports` rows into GitHub issues labeled `bug-report`.
//
// Run by .github/workflows/bug-reports-to-issues.yml (schedule + manual). It
// reads/marks rows through the Supabase Management API with the same
// `supabaseapi` PAT that Setup Supabase uses, and creates issues with the
// workflow's built-in GITHUB_TOKEN. Idempotent: only rows with
// github_issue IS NULL become issues, and each row is stamped with its issue
// number so it's never filed twice.
//
// Env: SUPABASE_PAT, GITHUB_TOKEN, GITHUB_REPOSITORY, PROJECT_REF (optional),
//      MGMT_API (optional).

import { issueTitle, issueBody, BUG_LABEL } from "./bugIssue.mjs";

const PAT = process.env.SUPABASE_PAT;
const REF = process.env.PROJECT_REF || "oigbbgtzzqiceetasayy";
const MGMT = process.env.MGMT_API || "https://api.supabase.com/v1";
const GH_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY; // "owner/repo"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 50;

if (!PAT) fail("Missing SUPABASE_PAT.");
if (!GH_TOKEN || !REPO) fail("Missing GITHUB_TOKEN / GITHUB_REPOSITORY.");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`${MGMT}/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase query ${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
}

async function ensureLabel() {
  const existing = await gh(`/repos/${REPO}/labels/${BUG_LABEL}`);
  if (existing.ok) return;
  await gh(`/repos/${REPO}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: BUG_LABEL,
      color: "d73a4a",
      description: "Filed from the in-app bug report button",
    }),
  });
}

async function main() {
  const repo = await gh(`/repos/${REPO}`);
  if (!repo.ok) fail(`Cannot read ${REPO} (HTTP ${repo.status}).`);
  if (!repo.body.has_issues) {
    console.log(
      "::warning::GitHub Issues are disabled on this repo, so bug reports " +
        "can't be filed. Enable them once: Settings → General → Features → " +
        "Issues, then re-run this workflow. No reports were synced.",
    );
    return;
  }

  await ensureLabel();

  const reports = await sql(
    "SELECT id, note, context, created_at, user_id FROM bug_reports " +
      `WHERE github_issue IS NULL ORDER BY created_at ASC LIMIT ${BATCH}`,
  );
  if (!Array.isArray(reports)) {
    fail(`Unexpected Supabase response shape: ${JSON.stringify(reports).slice(0, 300)}`);
  }
  if (reports.length === 0) {
    console.log("No new bug reports to sync.");
    return;
  }

  let filed = 0;
  for (const r of reports) {
    if (!UUID_RE.test(String(r.id))) {
      console.error(`Skipping row with non-uuid id: ${r.id}`);
      continue;
    }
    if (typeof r.context === "string") {
      try {
        r.context = JSON.parse(r.context);
      } catch {
        r.context = {};
      }
    }
    const issue = await gh(`/repos/${REPO}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: issueTitle(r),
        body: issueBody(r),
        labels: [BUG_LABEL],
      }),
    });
    if (!issue.ok) {
      console.error(`Failed to file issue for ${r.id} (HTTP ${issue.status}): ${JSON.stringify(issue.body).slice(0, 300)}`);
      continue;
    }
    const num = Number(issue.body.number);
    await sql(`UPDATE bug_reports SET github_issue = ${num}, synced_at = now() WHERE id = '${r.id}'`);
    console.log(`report ${r.id} → issue #${num}`);
    filed++;
  }
  console.log(`Filed ${filed} new issue(s) from ${reports.length} report(s).`);
}

main().catch((err) => fail(err.stack || String(err)));
