-- New-words game pool, v2 (v166): every real 2–4 character word whose
-- characters are ALL in the user's known set, minus the words the
-- client says to skip (saved, retired, resting). The exclusion happens
-- here so the window slides deeper as words are retired — v1
-- (words_from_chars) returned the same top-500 two-character words
-- forever, most of them already saved. Common words first.
--
-- translate(word, known, '') deletes every known character; an empty
-- remainder means the whole word is buildable.
--
-- Idempotent + additive, per ADR-0005. words_from_chars stays as the
-- client's fallback.

CREATE OR REPLACE FUNCTION discover_words(
  chars text[],
  exclude text[] DEFAULT '{}',
  max_results int DEFAULT 300
)
RETURNS TABLE(word text, rank int)
LANGUAGE sql STABLE AS $$
  SELECT w.word, w.rank
  FROM words w
  WHERE char_length(w.word) BETWEEN 2 AND 4
    AND translate(w.word, array_to_string(chars, ''), '') = ''
    AND NOT (w.word = ANY(exclude))
  ORDER BY w.rank ASC NULLS LAST, w.word
  LIMIT LEAST(max_results, 1000);
$$;

GRANT EXECUTE ON FUNCTION discover_words(text[], text[], int) TO anon, authenticated;
