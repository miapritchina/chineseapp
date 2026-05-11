import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// Saved sentences for the Sentence Studio. Source of truth: Supabase
// table `user_sentences`, PK (user_id, hanzi) — so re-saving the same
// sentence just bumps its created_at. localStorage is an offline
// read-cache only. On sign-in the cloud rows win on conflict; sentences
// created offline are uploaded.

const KEY = "e2.sentences";
const NO_TABLE = /relation .*user_sentences.*does not exist/i;

export interface SavedSentence {
  // Ordered saved-word keys — same shape as the composer draft, so
  // loading one back is just `replace(keys)`.
  keys: string[];
  // The composed hanzi string — also the identity (PK with user_id).
  hanzi: string;
  pinyin: string;
  savedAt: number;
}

function loadLocal(): SavedSentence[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SavedSentence[] = [];
    for (const s of parsed) {
      if (!s || typeof s !== "object") continue;
      if (typeof s.hanzi !== "string" || !Array.isArray(s.keys)) continue;
      out.push({
        hanzi: s.hanzi,
        keys: s.keys.filter((x: unknown): x is string => typeof x === "string"),
        pinyin: typeof s.pinyin === "string" ? s.pinyin : "",
        savedAt: typeof s.savedAt === "number" ? s.savedAt : Date.now(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function persistLocal(items: SavedSentence[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode */
  }
}

function sortNewest(items: SavedSentence[]): SavedSentence[] {
  return [...items].sort((a, b) => b.savedAt - a.savedAt);
}

interface Opts {
  userId: string | null;
}

export function useSavedSentences({ userId }: Opts) {
  const [items, setItems] = useState<SavedSentence[]>(() => sortNewest(loadLocal()));
  const lastUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      lastUserRef.current = null;
      return;
    }
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;
    let cancelled = false;
    (async () => {
      const localBefore = loadLocal();
      const { data, error } = await supabase
        .from("user_sentences")
        .select("hanzi, keys, pinyin, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        if (!NO_TABLE.test(error.message || "")) {
          console.warn("user_sentences load failed:", error);
        }
        return;
      }
      type Row = { hanzi: string; keys: unknown; pinyin: string | null; created_at: string };
      const remote = new Map<string, SavedSentence>();
      for (const r of (data || []) as Row[]) {
        remote.set(r.hanzi, {
          hanzi: r.hanzi,
          keys: Array.isArray(r.keys)
            ? (r.keys as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          pinyin: r.pinyin ?? "",
          savedAt: new Date(r.created_at).getTime(),
        });
      }
      // DB wins on conflict; keep local-only items (uploaded below).
      setItems((prev) => {
        const byHanzi = new Map<string, SavedSentence>();
        for (const s of prev) byHanzi.set(s.hanzi, s);
        for (const [h, r] of remote) byHanzi.set(h, r);
        const merged = sortNewest([...byHanzi.values()]);
        persistLocal(merged);
        return merged;
      });
      const toUpload = localBefore.filter((s) => !remote.has(s.hanzi));
      if (toUpload.length > 0) {
        const rows = toUpload.map((s) => ({
          user_id: userId,
          hanzi: s.hanzi,
          keys: s.keys,
          pinyin: s.pinyin,
          created_at: new Date(s.savedAt).toISOString(),
        }));
        const { error: upErr } = await supabase
          .from("user_sentences")
          .upsert(rows, { onConflict: "user_id,hanzi" });
        if (upErr && !NO_TABLE.test(upErr.message || "")) {
          console.error("user_sentences upload failed:", upErr);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const add = useCallback(
    (s: { keys: string[]; hanzi: string; pinyin: string }) => {
      if (s.keys.length === 0 || !s.hanzi) return;
      const now = Date.now();
      const row: SavedSentence = { keys: [...s.keys], hanzi: s.hanzi, pinyin: s.pinyin, savedAt: now };
      setItems((prev) => {
        const merged = sortNewest([row, ...prev.filter((x) => x.hanzi !== s.hanzi)]);
        persistLocal(merged);
        return merged;
      });
      if (userId) {
        void supabase
          .from("user_sentences")
          .upsert(
            {
              user_id: userId,
              hanzi: s.hanzi,
              keys: s.keys,
              pinyin: s.pinyin,
              created_at: new Date(now).toISOString(),
            },
            { onConflict: "user_id,hanzi" },
          )
          .then(({ error }) => {
            if (error && !NO_TABLE.test(error.message || "")) {
              console.error("user_sentences upsert failed:", error);
            }
          });
      }
    },
    [userId],
  );

  const remove = useCallback(
    (hanzi: string) => {
      setItems((prev) => {
        if (!prev.some((s) => s.hanzi === hanzi)) return prev;
        const next = prev.filter((s) => s.hanzi !== hanzi);
        persistLocal(next);
        return next;
      });
      if (userId) {
        void supabase
          .from("user_sentences")
          .delete()
          .eq("user_id", userId)
          .eq("hanzi", hanzi)
          .then(({ error }) => {
            if (error && !NO_TABLE.test(error.message || "")) {
              console.error("user_sentences delete failed:", error);
            }
          });
      }
    },
    [userId],
  );

  return { items, add, remove };
}
