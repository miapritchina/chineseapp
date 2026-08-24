-- In-app bug reports. Each row is one report submitted from the app's
-- "Report a bug" form: a free-text note plus an auto-captured context blob
-- (page, active word/char, app version, viewport, user-agent, timestamp —
-- see src/lib/bugReport.ts for the exact shape).
--
-- Access model:
--   * INSERT — allowed to anon AND authenticated. Anyone using the app can
--     file a report; a signed-in reporter stamps their user_id, an anonymous
--     one leaves it null. This is the one user-write table that anon may
--     touch, on purpose: a bug report is worth capturing even from someone
--     who never signed in. RLS still forbids anon from claiming another
--     user's id.
--   * SELECT — owner-only, so a signed-in reporter can see their own reports.
--     The maintainer reads the full table via the Supabase dashboard
--     (service role), the way GitHub issues would have been triaged.
--   * No UPDATE / DELETE policy — reports are append-only from the client.
--
-- Idempotent + additive (ADR-0005): CREATE ... IF NOT EXISTS, DROP POLICY
-- then CREATE. Safe to re-run.

CREATE TABLE IF NOT EXISTS bug_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note       TEXT NOT NULL,
  context    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_created
  ON bug_reports (created_at DESC);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone insert" ON bug_reports;
DROP POLICY IF EXISTS "owner read"    ON bug_reports;

-- Signed-in reporters must stamp their own id; anon reporters leave it null.
CREATE POLICY "anyone insert" ON bug_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "owner read" ON bug_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
