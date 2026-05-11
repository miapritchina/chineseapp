import { useCallback, useEffect, useState } from "react";

const KEY = "e2.draft";

// localStorage-backed draft for the Sentence Studio. Stores the saved-
// word KEYS the user has added to the composer (the actual Word rows
// are looked up via useDictionary at render time). Persisting just the
// keys means a stale draft survives a chinese-lexicon update.
export function useSentenceDraft() {
  const [keys, setKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(keys));
    } catch {
      /* quota / private mode */
    }
  }, [keys]);

  const append = useCallback((key: string) => {
    setKeys((prev) => [...prev, key]);
  }, []);

  const removeAt = useCallback((index: number) => {
    setKeys((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => {
    setKeys([]);
  }, []);

  return { keys, append, removeAt, clear };
}
