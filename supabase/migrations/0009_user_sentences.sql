-- Sentence Studio persistence. Two tables:
--
--   user_sentences       — saved sentences. PK (user_id, hanzi) so
--                          re-saving the same sentence just bumps its
--                          created_at (matches the client's de-dupe).
--   user_sentence_draft  — the single in-progress composer draft per
--                          user (one row, keyed by user_id).
--
-- `keys` holds the ordered saved-word keys (same shape as the localStorage
-- draft) — the actual Word rows are looked up via the dictionary at render
-- time, so a stale list survives a chinese-lexicon update.
--
-- Idempotent: CREATE ... IF NOT EXISTS, DROP POLICY then CREATE. Safe to
-- re-run. Additive — no drops/renames.

CREATE TABLE IF NOT EXISTS user_sentences (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hanzi      TEXT NOT NULL,
  keys       JSONB NOT NULL,
  pinyin     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hanzi)
);

CREATE INDEX IF NOT EXISTS idx_user_sentences_recent
  ON user_sentences (user_id, created_at DESC);

ALTER TABLE user_sentences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_sentences;
DROP POLICY IF EXISTS "owner insert" ON user_sentences;
DROP POLICY IF EXISTS "owner update" ON user_sentences;
DROP POLICY IF EXISTS "owner delete" ON user_sentences;

CREATE POLICY "owner read"   ON user_sentences FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_sentences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON user_sentences FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON user_sentences FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_sentence_draft (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  keys       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_sentence_draft ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner read"   ON user_sentence_draft;
DROP POLICY IF EXISTS "owner insert" ON user_sentence_draft;
DROP POLICY IF EXISTS "owner update" ON user_sentence_draft;
DROP POLICY IF EXISTS "owner delete" ON user_sentence_draft;

CREATE POLICY "owner read"   ON user_sentence_draft FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "owner insert" ON user_sentence_draft FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON user_sentence_draft FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON user_sentence_draft FOR DELETE
  USING (auth.uid() = user_id);
