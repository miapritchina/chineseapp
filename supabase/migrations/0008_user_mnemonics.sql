-- Per-user, per-key mnemonics. Stored as a separate table (not a column
-- on user_saves) so:
--   1. Mnemonics survive when a user removes a save and re-adds it later.
--   2. Mnemonics can attach to characters that aren't themselves saved
--      (e.g. a sub-character the user customized via CharPopup).
--   3. Anti-coupling: word-level vs char-level mnemonics share a uniform
--      shape; no schema change needed if we extend later.
--
-- The "edited" flag distinguishes a user-personalized mnemonic from one
-- that's still the auto-generated starter. Edited mnemonics show a
-- "your version" tag in CharPopup.
--
-- Idempotent: ADD ... IF NOT EXISTS, DROP POLICY then CREATE. Safe to
-- re-run.

CREATE TABLE IF NOT EXISTS user_mnemonics (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  text        TEXT NOT NULL,
  edited      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_mnemonics_updated
  ON user_mnemonics (user_id, updated_at DESC);

ALTER TABLE user_mnemonics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_mnemonics;
DROP POLICY IF EXISTS "owner insert" ON user_mnemonics;
DROP POLICY IF EXISTS "owner update" ON user_mnemonics;
DROP POLICY IF EXISTS "owner delete" ON user_mnemonics;

CREATE POLICY "owner read"   ON user_mnemonics FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_mnemonics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON user_mnemonics FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON user_mnemonics FOR DELETE
  USING (auth.uid() = user_id);
