-- Per-user saved words. RLS limits each row to its owner; the anon role
-- (used by signed-out browsers) can't see any rows.
--
-- Apply via the Seed workflow (toggle "Configure auth + run migration") or
-- by re-pasting the PAT into the workflow run UI. Idempotent.

CREATE TABLE IF NOT EXISTS user_saves (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word     TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_user_saves_user_id
  ON user_saves (user_id, saved_at DESC);

ALTER TABLE user_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_saves;
DROP POLICY IF EXISTS "owner insert" ON user_saves;
DROP POLICY IF EXISTS "owner delete" ON user_saves;

CREATE POLICY "owner read"   ON user_saves FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON user_saves FOR DELETE
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON user_saves FROM anon;
GRANT SELECT, INSERT, DELETE ON user_saves TO authenticated;
