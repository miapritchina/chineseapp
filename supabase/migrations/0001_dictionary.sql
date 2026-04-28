-- Chinese learning app — dictionary schema.
--
-- One table for words (joined to Postgres for full-text search). Char etymology
-- continues to ship as a static JSON file (data-chars.json) — small enough that
-- bouncing it through the DB just adds latency.
--
-- Apply via Supabase Dashboard → SQL Editor (paste this whole file) OR
-- `supabase db push` if you have the CLI linked.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS words (
  word              TEXT PRIMARY KEY,
  pinyin            TEXT NOT NULL,
  searchable_pinyin TEXT NOT NULL,
  definitions       JSONB NOT NULL,
  hsk               SMALLINT,
  rank              INT,
  trad              TEXT,
  -- Flat-text projection of `definitions` for trigram English-gloss search.
  -- Postgres won't let us declare this as a GENERATED column because the
  -- expression we'd need (array_to_string(ARRAY(SELECT jsonb_array_elements_text…)))
  -- contains a subquery, which generated columns disallow. Populated by
  -- scripts/seed-supabase.mjs as `defs.join(" ")` instead.
  definitions_text  TEXT NOT NULL DEFAULT ''
);

-- Frequency-ordered scan for the home grid.
CREATE INDEX IF NOT EXISTS idx_words_rank
  ON words (rank ASC NULLS LAST);

-- Prefix search (LIKE 'q%') against hanzi and tone-stripped pinyin.
CREATE INDEX IF NOT EXISTS idx_words_word_prefix
  ON words (word text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_words_pinyin_prefix
  ON words (searchable_pinyin text_pattern_ops);

-- Substring search (LIKE '%q%') everywhere via trigrams.
CREATE INDEX IF NOT EXISTS idx_words_word_trgm
  ON words USING gin (word gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_words_pinyin_trgm
  ON words USING gin (searchable_pinyin gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_words_defs_trgm
  ON words USING gin (definitions_text gin_trgm_ops);

-- Public read access; anon role cannot write.
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON words;
CREATE POLICY "public read" ON words FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE ON words FROM anon;
REVOKE INSERT, UPDATE, DELETE ON words FROM authenticated;

-- Tiered search: one round-trip, server-side ranking. Returns top 30.
-- tier 0 = exact hanzi, 1 = hanzi prefix, 2 = hanzi substring,
-- 3 = pinyin prefix, 4 = pinyin substring, 5 = English-gloss substring.
--
-- DROP first because Postgres won't let CREATE OR REPLACE change a function's
-- RETURNS TABLE signature, and 0004_search_words_rich.sql widens this same
-- function to include pinyin/definitions/hsk/trad. After 0004 has applied,
-- a subsequent re-run that loops back through 0001 would otherwise fail with
-- HTTP 400 ("cannot change return type of existing function").
DROP FUNCTION IF EXISTS search_words(TEXT);

CREATE FUNCTION search_words(q TEXT)
RETURNS TABLE (word TEXT, tier SMALLINT, rank INT)
LANGUAGE SQL STABLE AS $$
  WITH lq AS (SELECT trim(q) AS q),
  tiered AS (
    SELECT w.word, 0::SMALLINT AS tier, w.rank
      FROM words w, lq WHERE w.word = lq.q
    UNION ALL
    SELECT w.word, 1, w.rank
      FROM words w, lq WHERE w.word LIKE lq.q || '%' AND w.word <> lq.q
    UNION ALL
    SELECT w.word, 2, w.rank
      FROM words w, lq WHERE w.word LIKE '%' || lq.q || '%'
        AND w.word NOT LIKE lq.q || '%'
    UNION ALL
    SELECT w.word, 3, w.rank
      FROM words w, lq WHERE w.searchable_pinyin LIKE lq.q || '%'
        AND w.word NOT LIKE '%' || lq.q || '%'
    UNION ALL
    SELECT w.word, 4, w.rank
      FROM words w, lq WHERE w.searchable_pinyin LIKE '%' || lq.q || '%'
        AND w.searchable_pinyin NOT LIKE lq.q || '%'
        AND w.word NOT LIKE '%' || lq.q || '%'
    UNION ALL
    SELECT w.word, 5, w.rank
      FROM words w, lq WHERE w.definitions_text ILIKE '%' || lq.q || '%'
        AND w.word NOT LIKE '%' || lq.q || '%'
        AND w.searchable_pinyin NOT LIKE '%' || lq.q || '%'
  )
  SELECT word, MIN(tier) AS tier, rank
  FROM tiered
  GROUP BY word, rank
  ORDER BY tier ASC, rank ASC NULLS LAST
  LIMIT 30;
$$;

-- Make the RPC callable by anon (RLS on the underlying table still applies).
GRANT EXECUTE ON FUNCTION search_words(TEXT) TO anon, authenticated;
