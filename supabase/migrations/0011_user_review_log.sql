-- Append-only review log: one row per direct grade. This is the raw
-- material the FSRS optimizer needs (revlog: item, rating, timestamp)
-- — user_fsrs_state only holds CURRENT card state, so without this
-- table per-user parameter training could never happen. Written
-- fire-and-forget from useReview.grade()/attributeFailure().
--
-- Idempotent + additive, mirrors 0007_fsrs_state.sql.

CREATE TABLE IF NOT EXISTS user_review_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key    TEXT NOT NULL,
  item_kind   TEXT NOT NULL,
  facet       TEXT NOT NULL,
  rating      TEXT NOT NULL, -- 'Again' | 'Hard' | 'Good' | 'Easy'
  -- Card state BEFORE the grade, for optimizer features (elapsed time,
  -- prior stability). Nullable so logging never blocks a grade.
  prev_card   JSONB,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_review_log_user_time
  ON user_review_log (user_id, reviewed_at);

ALTER TABLE user_review_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_review_log;
DROP POLICY IF EXISTS "owner insert" ON user_review_log;

CREATE POLICY "owner read"   ON user_review_log FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_review_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
