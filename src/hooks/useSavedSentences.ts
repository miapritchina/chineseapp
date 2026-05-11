import { useCallback, useEffect, useState } from "react";

const KEY = "e2.sentences";

export interface SavedSentence {
  id: string;
  // Saved-word keys, in order — same shape as the draft, so loading one
  // back into the composer is just a `replace(keys)`.
  keys: string[];
  hanzi: string;
  pinyin: string;
  savedAt: number;
}

function load(): SavedSentence[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SavedSentence =>
        !!s &&
        typeof s.id === "string" &&
        Array.isArray(s.keys) &&
        typeof s.hanzi === "string",
    );
  } catch {
    return [];
  }
}

// localStorage-backed list of saved sentences for the Sentence Studio.
// Newest first. Purely local — nothing here touches Supabase or the SRS.
export function useSavedSentences() {
  const [items, setItems] = useState<SavedSentence[]>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* quota / private mode */
    }
  }, [items]);

  const add = useCallback(
    (s: { keys: string[]; hanzi: string; pinyin: string }) => {
      if (s.keys.length === 0) return;
      const id =
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setItems((prev) => {
        // De-dupe: if an identical hanzi sentence is already saved, bump
        // it to the top instead of stacking copies.
        const filtered = prev.filter((x) => x.hanzi !== s.hanzi);
        return [{ id, keys: [...s.keys], hanzi: s.hanzi, pinyin: s.pinyin, savedAt: Date.now() }, ...filtered];
      });
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { items, add, remove };
}
