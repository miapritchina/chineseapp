-- Reading bookmark for the 三字经 page: one row per user with the
-- furthest couplet index reached (0-based). User data → Supabase is
-- the source of truth (ADR-0001); localStorage mirrors it offline.
--
-- Idempotent + additive, mirrors 0007_fsrs_state.sql.

CREATE TABLE IF NOT EXISTS user_classic_progress (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  couplet_index INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_classic_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_classic_progress;
DROP POLICY IF EXISTS "owner insert" ON user_classic_progress;
DROP POLICY IF EXISTS "owner update" ON user_classic_progress;

CREATE POLICY "owner read"   ON user_classic_progress FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_classic_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON user_classic_progress FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
