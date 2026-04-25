import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Word } from "../lib/types";

const HOME_PAGE_SIZE = 60;

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

interface DictState {
  homeWords: Word[] | null;
  homeHasMore: boolean;
  loadingHome: boolean;
  loadingMore: boolean;
  error: string | null;
}

export function useDictionary() {
  const [state, setState] = useState<DictState>({
    homeWords: null,
    homeHasMore: true,
    loadingHome: true,
    loadingMore: false,
    error: null,
  });
  // State-backed cache so consumers re-render when missing words arrive.
  const [cache, setCache] = useState<Map<string, Word>>(new Map());

  const ingest = useCallback((rows: Word[]) => {
    if (rows.length === 0) return;
    setCache((prev) => {
      const next = new Map(prev);
      for (const w of rows) next.set(w.word, w);
      return next;
    });
  }, []);

  // Initial home page (top 60 by movieWordRank).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("words")
          .select("*")
          .order("rank", { ascending: true, nullsFirst: false })
          .range(0, HOME_PAGE_SIZE - 1);
        if (cancelled) return;
        if (error) throw error;
        const rows = (data || []).map(hydrate);
        ingest(rows);
        setState({
          homeWords: rows,
          homeHasMore: rows.length === HOME_PAGE_SIZE,
          loadingHome: false,
          loadingMore: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({ ...s, loadingHome: false, error: message }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ingest]);

  const loadMoreHome = useCallback(async () => {
    setState((s) => ({ ...s, loadingMore: true }));
    let offset = 0;
    setState((s) => {
      offset = s.homeWords?.length ?? 0;
      return s;
    });
    try {
      const { data, error } = await supabase
        .from("words")
        .select("*")
        .order("rank", { ascending: true, nullsFirst: false })
        .range(offset, offset + HOME_PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data || []).map(hydrate);
      ingest(rows);
      setState((s) => ({
        ...s,
        homeWords: [...(s.homeWords ?? []), ...rows],
        homeHasMore: rows.length === HOME_PAGE_SIZE,
        loadingMore: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, loadingMore: false, error: message }));
    }
  }, [ingest]);

  const search = useCallback(
    async (q: string): Promise<Word[]> => {
      const trimmed = q.trim();
      if (!trimmed) return [];
      const { data: hits, error: rpcErr } = await supabase.rpc("search_words", { q: trimmed });
      if (rpcErr) {
        console.error("search_words RPC failed:", rpcErr);
        return [];
      }
      if (!hits || hits.length === 0) return [];
      const need: string[] = hits.map((h: any) => h.word);
      // Always fetch the rows we need — gives us fresh data and ensures we
      // hold a Word object for every hit.
      const { data: rows, error: rowsErr } = await supabase
        .from("words")
        .select("*")
        .in("word", need);
      if (rowsErr) {
        console.error("search hydrate failed:", rowsErr);
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
      const { data, error } = await supabase
        .from("words")
        .select("*")
        .in("word", missing);
      if (error) {
        console.error("ensureCached failed:", error);
        return;
      }
      ingest((data || []).map(hydrate));
    },
    [cache, ingest],
  );

  const findWord = useCallback((key: string): Word | null => cache.get(key) ?? null, [cache]);

  return {
    homeWords: state.homeWords,
    homeHasMore: state.homeHasMore,
    loadingHome: state.loadingHome,
    loadingMore: state.loadingMore,
    error: state.error,
    loadMoreHome,
    search,
    ensureCached,
    findWord,
  };
}
