-- Per-row "I know this word well" flag. NULL = not learned (default).
-- A non-NULL timestamp = the moment the user tapped the cap.
--
-- Re-run "Setup Supabase" with your PAT to apply this — the workflow
-- loops over supabase/migrations/*.sql in order. Idempotent.

ALTER TABLE user_saves
  ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_saves_learned
  ON user_saves (user_id, learned_at)
  WHERE learned_at IS NOT NULL;
