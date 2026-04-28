import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "chinese.saved";

export interface SavedEntry {
  word: string;
  savedAt: number; // epoch ms
}

// localStorage v2 shape: { version: 2, items: [[word, savedAt], ...] }.
// v1 shape (legacy): plain string[] — migrated on read with savedAt = now.
function loadLocal(): Map<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 2 && Array.isArray(parsed.items)) {
      return new Map(
        (parsed.items as unknown[])
          .filter(
            (it): it is [string, number] =>
              Array.isArray(it) && typeof it[0] === "string" && typeof it[1] === "number",
          ),
      );
    }
    if (Array.isArray(parsed)) {
      const now = Date.now();
      const entries = (parsed as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((w) => [w, now] as const);
      return new Map(entries);
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function persistLocal(items: Map<string, number>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, items: [...items.entries()] }),
    );
  } catch {
    /* private mode / quota — silent */
  }
}

interface UseSavedOpts {
  userId: string | null;
}

// Saved words live in two places when signed in: localStorage (offline
// resilience and survives sign-out) and the per-user `user_saves` table.
//
//   Signed out  → reads/writes localStorage only.
//   Signed in   → on first sync: union localStorage + DB (DB saved_at wins
//                 when both exist); upload local-only entries; subsequent
//                 toggles write through to both.
//   Sign out    → keeps the localStorage copy as-is.
export function useSaved({ userId }: UseSavedOpts) {
  const [items, setItems] = useState<Map<string, number>>(() => loadLocal());
  const [syncing, setSyncing] = useState(false);
  const lastSyncedUserRef = useRef<string | null>(null);

  // Read-only views derived from `items`.
  const saved = useMemo(() => new Set(items.keys()), [items]);
  const savedList = useMemo<SavedEntry[]>(
    () =>
      [...items.entries()]
        .sort(([, a], [, b]) => b - a) // newest first
        .map(([word, savedAt]) => ({ word, savedAt })),
    [items],
  );

  // Initial sync when a user signs in (or switches accounts).
  useEffect(() => {
    if (!userId) {
      lastSyncedUserRef.current = null;
      return;
    }
    if (lastSyncedUserRef.current === userId) return;
    lastSyncedUserRef.current = userId;

    let cancelled = false;
    setSyncing(true);
    (async () => {
      const { data, error } = await supabase
        .from("user_saves")
        .select("word, saved_at")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) {
        console.error("user_saves load failed:", error);
        setSyncing(false);
        return;
      }

      const remote = new Map<string, number>(
        (data || []).map((r: { word: string; saved_at: string }) => [
          r.word,
          new Date(r.saved_at).getTime(),
        ]),
      );

      // Snapshot current local state for the diff.
      let localBeforeMerge: Map<string, number> = new Map();
      setItems((prev) => {
        localBeforeMerge = prev;
        // Merge: prefer DB saved_at when both exist.
        const merged = new Map(prev);
        for (const [word, ts] of remote) merged.set(word, ts);
        persistLocal(merged);
        return merged;
      });

      // Upload anything local-only (no explicit saved_at — DB default now()).
      const toUpload = [...localBeforeMerge.keys()].filter((w) => !remote.has(w));
      if (toUpload.length > 0) {
        const { error: upErr } = await supabase
          .from("user_saves")
          .upsert(
            toUpload.map((w) => ({ user_id: userId, word: w })),
            { onConflict: "user_id,word" },
          );
        if (upErr) console.error("user_saves upload failed:", upErr);
      }

      if (!cancelled) setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    (key: string) => {
      let willBeSaved = false;
      setItems((prev) => {
        const next = new Map(prev);
        if (next.has(key)) {
          next.delete(key);
          willBeSaved = false;
        } else {
          next.set(key, Date.now());
          willBeSaved = true;
        }
        persistLocal(next);
        return next;
      });

      if (userId) {
        if (willBeSaved) {
          supabase
            .from("user_saves")
            .upsert({ user_id: userId, word: key }, { onConflict: "user_id,word" })
            .then(({ error }) => {
              if (error) console.error("insert user_saves failed:", error);
            });
        } else {
          supabase
            .from("user_saves")
            .delete()
            .eq("user_id", userId)
            .eq("word", key)
            .then(({ error }) => {
              if (error) console.error("delete user_saves failed:", error);
            });
        }
      }
    },
    [userId],
  );

  const importSaved = useCallback(
    async (words: string[]): Promise<{ added: number; total: number }> => {
      const total = words.length;
      if (!total) return { added: 0, total: 0 };
      const now = Date.now();
      let added = 0;
      setItems((prev) => {
        const next = new Map(prev);
        for (const w of words) {
          if (!next.has(w)) {
            next.set(w, now);
            added++;
          }
        }
        persistLocal(next);
        return next;
      });
      if (userId) {
        const rows = words.map((w) => ({ user_id: userId, word: w }));
        const { error } = await supabase
          .from("user_saves")
          .upsert(rows, { onConflict: "user_id,word" });
        if (error) console.error("import upload failed:", error);
      }
      return { added, total };
    },
    [userId],
  );

  const clearAll = useCallback(async (): Promise<{ cleared: number }> => {
    let count = 0;
    setItems((prev) => {
      count = prev.size;
      persistLocal(new Map());
      return new Map();
    });
    if (userId) {
      const { error } = await supabase
        .from("user_saves")
        .delete()
        .eq("user_id", userId);
      if (error) console.error("clearAll user_saves delete failed:", error);
    }
    return { cleared: count };
  }, [userId]);

  const exportSaved = useCallback(() => {
    if (savedList.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      app: "chinese",
      exported: new Date().toISOString(),
      count: savedList.length,
      saved: savedList.map((s) => s.word),
      // Round-trippable v2 shape with timestamps.
      items: savedList.map((s) => ({ word: s.word, savedAt: s.savedAt })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chinese-saved-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [savedList]);

  return { saved, savedList, toggle, exportSaved, importSaved, clearAll, syncing };
}
