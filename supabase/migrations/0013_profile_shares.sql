-- Profile share links (v110). "Share my words" now shares the PROFILE,
-- not a snapshot: the recipient resolves the token to the sharer's
-- LIVE saved set at click time via get_profile_words(). The
-- user_shares table is unchanged — a token row now just identifies its
-- owner; the words column stays as a courtesy snapshot for pre-v110
-- clients that still resolve via get_shared_words().
--
-- One stable token per account: the share flow reuses the owner's
-- oldest row instead of minting a new one per share, so the link a
-- friend saved keeps tracking the profile forever. The new UPDATE
-- policy lets the owner refresh the courtesy snapshot on re-share.
--
-- Idempotent + additive: DROP POLICY IF EXISTS then CREATE, CREATE OR
-- REPLACE FUNCTION. No drops/renames. Safe to re-run.

DROP POLICY IF EXISTS "owner update" ON user_shares;
CREATE POLICY "owner update" ON user_shares FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Live profile lookup: the token owner's current saved words, oldest
-- first (so the recipient's import roughly preserves the sharer's
-- learning order). NULL when the token doesn't exist OR the profile
-- is empty. SECURITY DEFINER so it can read past RLS; search_path
-- pinned + fully-qualified names to keep it injection-safe. Exposes
-- only the word list — never the owner's identity.
CREATE OR REPLACE FUNCTION get_profile_words(p_token text)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT jsonb_agg(s.word ORDER BY s.saved_at ASC)
  FROM public.user_shares sh
  JOIN public.user_saves s ON s.user_id = sh.user_id
  WHERE sh.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION get_profile_words(text) TO anon, authenticated;
