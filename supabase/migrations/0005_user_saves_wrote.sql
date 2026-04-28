-- Per-row "I learned to write this character" flag (the calligraphy brush
-- third tier). NULL = not yet wrote.
--
-- The full progression is now:
--   ☆  saved      → user_saves row exists
--   🎓 learned   → learned_at NOT NULL
--   ✒  wrote     → wrote_at NOT NULL  (this column)
--
-- Each tier implies the previous: wrote ⇒ learned ⇒ saved.

ALTER TABLE user_saves
  ADD COLUMN IF NOT EXISTS wrote_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_saves_wrote
  ON user_saves (user_id, wrote_at)
  WHERE wrote_at IS NOT NULL;
