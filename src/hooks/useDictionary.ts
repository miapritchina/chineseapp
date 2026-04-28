import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Word } from "../lib/types";

// Hydrate a row from Supabase (snake_case, no derived fields) into the
// camelCase Word shape the rest of the app expects.
function hydrate(row: any): Word {
  const word = row.word as string;
  return {
    word,
    pinyin: row.pinyin,
    searchablePinyin: row.searchable_pinyin,
    definitions: row.definitions ?? [],
    hsk: row.hsk,
    rank: row.rank,
    trad: row.trad ?? undefined,
    simp: word,
    chars: [...word],
  };
}

export function useDictionary() {
  // State-backed cache so consumers re-render when missing words arrive.
  const [cache, setCache] = useState<Map<string, Word>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const ingest = useCallback((rows: Word[]) => {
    if (rows.length === 0) return;
    setCache((prev) => {
      const next = new Map(prev);
      for (const w of rows) next.set(w.word, w);
      return next;
    });
  }, []);

  const search = useCallback(
    async (q: string): Promise<Word[]> => {
      const trimmed = q.trim();
      if (!trimmed) return [];
      const { data: hits, error: rpcErr } = await supabase.rpc("search_words", { q: trimmed });
      if (rpcErr) {
        console.error("search_words RPC failed:", rpcErr);
        setError(rpcErr.message);
        return [];
      }
      if (!hits || hits.length === 0) return [];
      const need: string[] = hits.map((h: { word: string }) => h.word);
      const { data: rows, error: rowsErr } = await supabase
        .from("words")
        .select("*")
        .in("word", need);
      if (rowsErr) {
        console.error("search hydrate failed:", rowsErr);
        setError(rowsErr.message);
        return [];
      }
      const hydrated = (rows || []).map(hydrate);
      ingest(hydrated);
      const byWord = new Map(hydrated.map((w) => [w.word, w]));
      // Preserve RPC tier order.
      const out: Word[] = [];
      for (const h of hits) {
        const w = byWord.get(h.word);
        if (w) out.push(w);
      }
      return out;
    },
    [ingest],
  );

  // Lazy multi-word fetch — anything not already in cache, fetch in one query.
  const ensureCached = useCallback(
    async (keys: string[]): Promise<void> => {
      const missing = keys.filter((k) => !cache.has(k));
      if (missing.length === 0) return;
      const { data, error: err } = await supabase
        .from("words")
        .select("*")
        .in("word", missing);
      if (err) {
        console.error("ensureCached failed:", err);
        setError(err.message);
        return;
      }
      ingest((data || []).map(hydrate));
    },
    [cache, ingest],
  );

  const findWord = useCallback((key: string): Word | null => cache.get(key) ?? null, [cache]);

  return { error, search, ensureCached, findWord };
}
