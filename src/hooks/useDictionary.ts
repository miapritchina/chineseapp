import { useCallback, useRef, useState } from "react";
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

const SEARCH_CACHE_LIMIT = 50;

export function useDictionary() {
  // State-backed cache so consumers re-render when missing words arrive.
  const [cache, setCache] = useState<Map<string, Word>>(new Map());
  const [error, setError] = useState<string | null>(null);
  // In-memory cache of recent search results. Per-query Word[] in tier order.
  // LRU-ish: evicted in insertion order once the size cap is reached.
  const searchCacheRef = useRef<Map<string, Word[]>>(new Map());

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

      // Cache hit: instant. Refreshes recency by re-inserting.
      const cached = searchCacheRef.current.get(trimmed);
      if (cached) {
        searchCacheRef.current.delete(trimmed);
        searchCacheRef.current.set(trimmed, cached);
        return cached;
      }

      // search_words RPC ideally returns full row data (after migration 0004).
      // If the older "lean" RPC is still in place — returning only word/tier/
      // rank — pinyin/definitions/etc come back undefined and the UI looks
      // empty. Detect that and fall back to a hydrate query so the app keeps
      // working while you re-run "Setup Supabase" to apply 0004.
      const { data, error: rpcErr } = await supabase.rpc("search_words", { q: trimmed });
      if (rpcErr) {
        console.error("search_words RPC failed:", rpcErr);
        setError(rpcErr.message);
        return [];
      }
      const rows = (data || []) as any[];
      if (rows.length === 0) {
        searchCacheRef.current.set(trimmed, []);
        return [];
      }

      const isRich = rows[0].pinyin !== undefined;
      let hydrated: Word[];
      if (isRich) {
        hydrated = rows.map(hydrate);
      } else {
        // Lean RPC — fall back to a hydrate query, preserve RPC tier order.
        const need = rows.map((r) => r.word as string);
        const { data: full, error: rowsErr } = await supabase
          .from("words")
          .select("*")
          .in("word", need);
        if (rowsErr) {
          console.error("search hydrate failed:", rowsErr);
          setError(rowsErr.message);
          return [];
        }
        const byWord = new Map((full || []).map((r) => [r.word, hydrate(r)]));
        hydrated = rows
          .map((r) => byWord.get(r.word))
          .filter((w): w is Word => !!w);
      }

      // An exact-hanzi hit always outranks substring/compound matches —
      // searching 中国 must surface 中国 above 发展中国家 even if the RPC's
      // tiering doesn't. Stable partition: exact match(es) first, rest in
      // their original tier order.
      const exact = hydrated.filter((w) => w.word === trimmed);
      if (exact.length > 0 && hydrated[0]?.word !== trimmed) {
        hydrated = [...exact, ...hydrated.filter((w) => w.word !== trimmed)];
      }

      ingest(hydrated);

      // Cache + bound size.
      searchCacheRef.current.set(trimmed, hydrated);
      while (searchCacheRef.current.size > SEARCH_CACHE_LIMIT) {
        const firstKey = searchCacheRef.current.keys().next().value;
        if (firstKey === undefined) break;
        searchCacheRef.current.delete(firstKey);
      }

      return hydrated;
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
