import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// The Sentence Studio composer draft — the in-progress list of saved-word
// KEYS the user has added (the Word rows are looked up via the dictionary
// at render time, so a stale list survives a chinese-lexicon update).
//
// Per the project's data-persistence policy: Supabase is the source of
// truth (table `user_sentence_draft`, one row per user). localStorage is
// only an offline read-cache for instant paint. On sign-in the cloud
// draft wins; an offline draft is uploaded only when the cloud has none.

const KEY = "e2.draft";
const NO_TABLE = /relation .*user_sentence_draft.*does not exist/i;

function loadLocal(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Back-compat: the pre-sync format was a bare array of keys.
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.keys)
        ? parsed.keys
        : [];
    return arr.filter((x: unknown): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function persistLocal(keys: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* quota / private mode */
  }
}

interface Opts {
  userId: string | null;
}

export function useSentenceDraft({ userId }: Opts) {
  const [keys, setKeys] = useState<string[]>(() => loadLocal());
  const syncedRef = useRef(false);
  const lastUserRef = useRef<string | null>(null);

  // Local cache mirror — always.
  useEffect(() => {
    persistLocal(keys);
  }, [keys]);

  // On sign-in / account switch: the cloud draft wins. If there isn't
  // one but a local draft exists, push it up once (offline → cloud).
  useEffect(() => {
    if (!userId) {
      syncedRef.current = false;
      lastUserRef.current = null;
      return;
    }
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_sentence_draft")
        .select("keys")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (!NO_TABLE.test(error.message || "")) {
          console.warn("user_sentence_draft load failed:", error);
        }
        // Migration not applied — keep working off the local cache.
        syncedRef.current = false;
        return;
      }
      if (data && Array.isArray(data.keys)) {
        const remoteKeys = (data.keys as unknown[]).filter(
          (x): x is string => typeof x === "string",
        );
        setKeys(remoteKeys);
        persistLocal(remoteKeys);
      } else {
        const local = loadLocal();
        if (local.length > 0) {
          const { error: upErr } = await supabase
            .from("user_sentence_draft")
            .upsert(
              { user_id: userId, keys: local, updated_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
          if (upErr && !NO_TABLE.test(upErr.message || "")) {
            console.error("user_sentence_draft seed failed:", upErr);
          }
        }
      }
      syncedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Write through to the cloud on every change, once the initial sync
  // has run (so we don't echo a stale local draft over the cloud one
  // before the catch-up read lands).
  useEffect(() => {
    if (!userId || !syncedRef.current) return;
    void supabase
      .from("user_sentence_draft")
      .upsert(
        { user_id: userId, keys, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .then(({ error }) => {
        if (error && !NO_TABLE.test(error.message || "")) {
          console.error("user_sentence_draft upsert failed:", error);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, userId]);

  const append = useCallback((key: string) => {
    setKeys((prev) => [...prev, key]);
  }, []);

  const removeAt = useCallback((index: number) => {
    setKeys((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => {
    setKeys([]);
  }, []);

  const replace = useCallback((next: string[]) => {
    setKeys(next.filter((x): x is string => typeof x === "string"));
  }, []);

  return { keys, append, removeAt, clear, replace };
}
