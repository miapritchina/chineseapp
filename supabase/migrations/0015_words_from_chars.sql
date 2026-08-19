-- New-words game pool (v138): all real two-character words buildable
-- from the user's ENTIRE known-character set, in one query — replaces
-- the client-side guess-every-pair probing that capped the game at 60
-- characters. Common words first.
--
-- Idempotent + additive, per ADR-0005.

CREATE OR REPLACE FUNCTION words_from_chars(chars text[], max_results int DEFAULT 500)
RETURNS TABLE(word text, rank int)
LANGUAGE sql STABLE AS $$
  SELECT w.word, w.rank
  FROM words w
  WHERE char_length(w.word) = 2
    AND substr(w.word, 1, 1) = ANY(chars)
    AND substr(w.word, 2, 1) = ANY(chars)
  ORDER BY w.rank ASC NULLS LAST
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION words_from_chars(text[], int) TO anon, authenticated;
