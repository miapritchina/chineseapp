-- Spaced-repetition scheduler state. Each (item_key, item_kind, facet)
-- tuple gets one row per user with the serialized ts-fsrs Card and the
-- next due time.
--
-- item_kind = 'word' | 'char' | 'component'
-- facet     = 'recognition' | 'phoneticTap' | 'componentSound' |
--             'familyTransfer' | 'production'
--
-- The first PR only writes ('word', 'recognition'). Other kinds + facets
-- are introduced in later PRs without schema changes.
--
-- Idempotent: ADD ... IF NOT EXISTS, mirrors 0006_user_saves_review.sql.

CREATE TABLE IF NOT EXISTS user_fsrs_state (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key       TEXT NOT NULL,
  item_kind      TEXT NOT NULL DEFAULT 'word',
  facet          TEXT NOT NULL DEFAULT 'recognition',
  card           JSONB NOT NULL,
  due_at         TIMESTAMPTZ NOT NULL,
  last_review_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key, item_kind, facet)
);

CREATE INDEX IF NOT EXISTS idx_user_fsrs_due
  ON user_fsrs_state (user_id, due_at);

ALTER TABLE user_fsrs_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_fsrs_state;
DROP POLICY IF EXISTS "owner insert" ON user_fsrs_state;
DROP POLICY IF EXISTS "owner update" ON user_fsrs_state;
DROP POLICY IF EXISTS "owner delete" ON user_fsrs_state;

CREATE POLICY "owner read"   ON user_fsrs_state FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_fsrs_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON user_fsrs_state FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON user_fsrs_state FOR DELETE
  USING (auth.uid() = user_id);
