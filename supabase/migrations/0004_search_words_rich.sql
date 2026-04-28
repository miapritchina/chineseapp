-- Speed up search:
--   1. Return full row data so the client doesn't need a second hydrate query.
--   2. Drop the AND NOT LIKE … exclusions; pick the best tier per row via
--      GROUP BY MIN(tier) instead. Negated LIKE can't use the prefix btree;
--      positive matches in each branch can.
--   3. Per-tier LIMIT keeps intermediate row counts bounded for high-frequency
--      English glosses (e.g. ILIKE '%a%' would otherwise fan out).
--
-- Idempotent — DROP FUNCTION IF EXISTS first because Postgres won't let
-- CREATE OR REPLACE change a function's RETURNS TABLE signature
-- (0001_dictionary.sql created the lean shape; we need the wider one).

DROP FUNCTION IF EXISTS search_words(TEXT);

CREATE FUNCTION search_words(q TEXT)
RETURNS TABLE (
  word               TEXT,
  tier               SMALLINT,
  rank               INT,
  pinyin             TEXT,
  searchable_pinyin  TEXT,
  definitions        JSONB,
  hsk                SMALLINT,
  trad               TEXT
)
LANGUAGE SQL STABLE PARALLEL SAFE AS $$
  WITH lq AS (SELECT trim(q) AS q),
  candidates AS (
    -- Exact hanzi match.
    (SELECT w.word, 0::SMALLINT AS tier
     FROM words w, lq WHERE w.word = lq.q LIMIT 1)
    UNION ALL
    -- Hanzi prefix.
    (SELECT w.word, 1::SMALLINT FROM words w, lq
     WHERE w.word LIKE lq.q || '%'
     ORDER BY w.rank ASC NULLS LAST LIMIT 60)
    UNION ALL
    -- Hanzi substring.
    (SELECT w.word, 2::SMALLINT FROM words w, lq
     WHERE w.word LIKE '%' || lq.q || '%'
     ORDER BY w.rank ASC NULLS LAST LIMIT 100)
    UNION ALL
    -- Pinyin prefix (tone-stripped).
    (SELECT w.word, 3::SMALLINT FROM words w, lq
     WHERE w.searchable_pinyin LIKE lq.q || '%'
     ORDER BY w.rank ASC NULLS LAST LIMIT 60)
    UNION ALL
    -- Pinyin substring.
    (SELECT w.word, 4::SMALLINT FROM words w, lq
     WHERE w.searchable_pinyin LIKE '%' || lq.q || '%'
     ORDER BY w.rank ASC NULLS LAST LIMIT 100)
    UNION ALL
    -- English-gloss substring.
    (SELECT w.word, 5::SMALLINT FROM words w, lq
     WHERE w.definitions_text ILIKE '%' || lq.q || '%'
     ORDER BY w.rank ASC NULLS LAST LIMIT 100)
  ),
  best AS (
    SELECT word, MIN(tier) AS tier
    FROM candidates
    GROUP BY word
  )
  SELECT
    b.word,
    b.tier,
    w.rank,
    w.pinyin,
    w.searchable_pinyin,
    w.definitions,
    w.hsk,
    w.trad
  FROM best b
  JOIN words w USING (word)
  ORDER BY b.tier ASC, w.rank ASC NULLS LAST
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION search_words(TEXT) TO anon, authenticated;
