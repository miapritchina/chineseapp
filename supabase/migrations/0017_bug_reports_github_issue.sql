-- Bridge bug reports to GitHub issues. The `.github/workflows/
-- bug-reports-to-issues.yml` job reads unsynced rows (github_issue IS NULL),
-- opens one GitHub issue per report, then stamps the row so it's never
-- duplicated. See docs/architecture/bug-report-triage.md.
--
-- Additive + idempotent (ADR-0005): ADD COLUMN IF NOT EXISTS only. The sync
-- writes these via the Management API (service role), which bypasses RLS, so
-- no policy change is needed.

ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS github_issue INTEGER;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS synced_at    TIMESTAMPTZ;

-- The sync scans for un-synced reports; index the common predicate.
CREATE INDEX IF NOT EXISTS idx_bug_reports_unsynced
  ON bug_reports (created_at) WHERE github_issue IS NULL;
