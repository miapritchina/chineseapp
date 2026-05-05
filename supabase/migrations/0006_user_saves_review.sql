-- Add a fourth tier ("review") to user_saves alongside saved/learned/wrote.
--
-- Status model: each saved word has at most one of learned_at / wrote_at /
-- review_at populated (mutually exclusive). saved_at is always set.
-- The four UI statuses are derived in priority order:
--   wrote   if wrote_at IS NOT NULL
--   learned else if learned_at IS NOT NULL
--   review  else if review_at IS NOT NULL
--   saved   else
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- Apply via the Setup Supabase workflow or `supabase db push`.

ALTER TABLE user_saves
  ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_saves_review
  ON user_saves (user_id) WHERE review_at IS NOT NULL;
