-- "Share my words" short-link records. A signed-in user mints a row with a
-- random short token; the share URL is then just ?share=<token>, so the
-- link stays small no matter how many words are in the set.
--
-- (Signed-out users — and a fallback whenever this table is missing or the
-- insert fails — get the self-contained ?share=<lz-string blob> link
-- instead; see src/lib/share.ts. So this is a best-effort enhancement, not
-- a hard dependency.)
--
-- `words` is the ordered list of saved-word keys (same shape as the inline
-- payload). It's only ever read by token, so a stale list survives a
-- chinese-lexicon update — importSaved just skips anything that doesn't
-- resolve.
--
-- Access model:
--   * INSERT / SELECT (own rows) / DELETE — restricted to the owner via RLS.
--   * Public "open this share link" reads go through get_shared_words(token),
--     a SECURITY DEFINER function: the recipient (anon or signed-in) can
--     fetch the word list for a token they hold, but can't enumerate the
--     table or see who owns what.
--
-- Idempotent: CREATE ... IF NOT EXISTS, DROP POLICY then CREATE, CREATE OR
-- REPLACE FUNCTION. Additive — no drops/renames. Safe to re-run.

CREATE TABLE IF NOT EXISTS user_shares (
  token      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  words      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_shares_owner
  ON user_shares (user_id, created_at DESC);

ALTER TABLE user_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_shares;
DROP POLICY IF EXISTS "owner insert" ON user_shares;
DROP POLICY IF EXISTS "owner delete" ON user_shares;

CREATE POLICY "owner read"   ON user_shares FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON user_shares FOR DELETE
  USING (auth.uid() = user_id);

-- Public token lookup: returns just the word list for a given token, or
-- NULL if there's no such share. SECURITY DEFINER so it can read past RLS;
-- search_path pinned + fully-qualified table name to keep it injection-safe.
CREATE OR REPLACE FUNCTION get_shared_words(p_token text)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT words FROM public.user_shares WHERE token = p_token;
$$;

GRANT EXECUTE ON FUNCTION get_shared_words(text) TO anon, authenticated;
