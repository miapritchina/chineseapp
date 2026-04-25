import { useEffect, useRef, useState } from "react";
import type { DataWords, Word } from "../lib/types";

interface DictState {
  words: Word[] | null;
  index: Map<string, Word> | null;
  error: string | null;
}

// Phase 1: still fetches the static /data.json. Phase 2 will swap this for
// Supabase queries (paginated home + RPC search).
export function useDictionary(): DictState & { findWord: (key: string) => Word | null } {
  const [state, setState] = useState<DictState>({ words: null, index: null, error: null });
  const indexRef = useRef<Map<string, Word> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("./data.json", { cache: "no-cache" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: DataWords = await resp.json();
        if (cancelled) return;
        const index = new Map<string, Word>();
        for (const w of data.words) {
          // Hydrate trimmed shape: simp == word, chars == [...word].
          w.simp = w.word;
          w.chars = [...w.word];
          index.set(w.word, w);
        }
        indexRef.current = index;
        setState({ words: data.words, index, error: null });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ words: null, index: null, error: message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const findWord = (key: string): Word | null => indexRef.current?.get(key) ?? null;

  return { ...state, findWord };
}
