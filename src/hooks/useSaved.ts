import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const SAVED_KEY = "chinese.saved";
const LEARNED_KEY = "chinese.learned";
const WROTE_KEY = "chinese.wrote";

export interface SavedEntry {
  word: string;
  savedAt: number; // epoch ms
}

// localStorage v2 shape: { version: 2, items: [[word, ts], ...] }.
// v1 shape (legacy, savedKey only): plain string[].
function loadLocalMap(key: string): Map<string, number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 2 && Array.isArray(parsed.items)) {
      return new Map(
        (parsed.items as unknown[]).filter(
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

function persistLocalMap(key: string, items: Map<string, number>) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: 2, items: [...items.entries()] }),
    );
  } catch {
    /* private mode / quota — silent */
  }
}

interface UseSavedOpts {
  userId: string | null;
}

// Three-tier saved/learned/wrote progression. Each tier implies the previous:
//   ★ saved       (user_saves row exists)
//   🎓 learned    (learned_at NOT NULL) ⇒ also saved
//   ✒  wrote      (wrote_at NOT NULL)   ⇒ also learned ⇒ also saved
//
// All three live in localStorage (offline resilience + survives sign-out)
// AND mirror to user_saves columns when signed in.
export function useSaved({ userId }: UseSavedOpts) {
  const [items, setItems] = useState<Map<string, number>>(() => loadLocalMap(SAVED_KEY));
  const [learnedItems, setLearnedItems] = useState<Map<string, number>>(() =>
    loadLocalMap(LEARNED_KEY),
  );
  const [wroteItems, setWroteItems] = useState<Map<string, number>>(() =>
    loadLocalMap(WROTE_KEY),
  );
  const [syncing, setSyncing] = useState(false);
  const lastSyncedUserRef = useRef<string | null>(null);

  // Read-only views.
  const saved = useMemo(() => new Set(items.keys()), [items]);
  const learned = useMemo(() => new Set(learnedItems.keys()), [learnedItems]);
  const wrote = useMemo(() => new Set(wroteItems.keys()), [wroteItems]);
  const savedList = useMemo<SavedEntry[]>(
    () =>
      [...items.entries()]
        .sort(([, a], [, b]) => b - a)
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
        .select("word, saved_at, learned_at, wrote_at")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) {
        console.error("user_saves load failed:", error);
        setSyncing(false);
        return;
      }

      const remoteSaved = new Map<string, number>();
      const remoteLearned = new Map<string, number>();
      const remoteWrote = new Map<string, number>();
      for (const r of (data || []) as {
        word: string;
        saved_at: string;
        learned_at: string | null;
        wrote_at: string | null;
      }[]) {
        remoteSaved.set(r.word, new Date(r.saved_at).getTime());
        if (r.learned_at) remoteLearned.set(r.word, new Date(r.learned_at).getTime());
        if (r.wrote_at) remoteWrote.set(r.word, new Date(r.wrote_at).getTime());
      }

      let localSavedBefore: Map<string, number> = new Map();
      let localLearnedBefore: Map<string, number> = new Map();
      let localWroteBefore: Map<string, number> = new Map();

      setItems((prev) => {
        localSavedBefore = prev;
        const merged = new Map(prev);
        for (const [word, ts] of remoteSaved) merged.set(word, ts);
        persistLocalMap(SAVED_KEY, merged);
        return merged;
      });
      setLearnedItems((prev) => {
        localLearnedBefore = prev;
        const merged = new Map(prev);
        for (const [word, ts] of remoteLearned) merged.set(word, ts);
        persistLocalMap(LEARNED_KEY, merged);
        return merged;
      });
      setWroteItems((prev) => {
        localWroteBefore = prev;
        const merged = new Map(prev);
        for (const [word, ts] of remoteWrote) merged.set(word, ts);
        persistLocalMap(WROTE_KEY, merged);
        return merged;
      });

      const allLocalKeys = new Set<string>([
        ...localSavedBefore.keys(),
        ...localLearnedBefore.keys(),
        ...localWroteBefore.keys(),
      ]);
      const toUpload = [...allLocalKeys].filter(
        (w) =>
          !remoteSaved.has(w) ||
          (localLearnedBefore.has(w) && !remoteLearned.has(w)) ||
          (localWroteBefore.has(w) && !remoteWrote.has(w)),
      );
      if (toUpload.length > 0) {
        const now = new Date().toISOString();
        const rows = toUpload.map((w) => ({
          user_id: userId,
          word: w,
          ...(localLearnedBefore.has(w) ? { learned_at: now } : {}),
          ...(localWroteBefore.has(w) ? { wrote_at: now } : {}),
        }));
        const { error: upErr } = await supabase
          .from("user_saves")
          .upsert(rows, { onConflict: "user_id,word" });
        if (upErr) console.error("user_saves upload failed:", upErr);
      }

      if (!cancelled) setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Toggle saved (star). When turning OFF, also clears learned + wrote since
  // both depend on saved.
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
        persistLocalMap(SAVED_KEY, next);
        return next;
      });

      if (!willBeSaved) {
        // cascade clear
        setLearnedItems((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          persistLocalMap(LEARNED_KEY, next);
          return next;
        });
        setWroteItems((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          persistLocalMap(WROTE_KEY, next);
          return next;
        });
      }

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

  // Toggle learned (cap). Implies saved — auto-saves if not already. When
  // turning OFF, also clears wrote (wrote implies learned).
  const toggleLearned = useCallback(
    (key: string) => {
      let willBeLearned = false;

      setItems((prev) => {
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, Date.now());
        persistLocalMap(SAVED_KEY, next);
        return next;
      });

      setLearnedItems((prev) => {
        const next = new Map(prev);
        if (next.has(key)) {
          next.delete(key);
          willBeLearned = false;
        } else {
          next.set(key, Date.now());
          willBeLearned = true;
        }
        persistLocalMap(LEARNED_KEY, next);
        return next;
      });

      if (!willBeLearned) {
        // cascade clear: turning off learned also clears wrote
        setWroteItems((prev) => {
          if (!prev.has(key)) return prev;
          const next = new Map(prev);
          next.delete(key);
          persistLocalMap(WROTE_KEY, next);
          return next;
        });
      }

      if (userId) {
        const now = new Date().toISOString();
        const row = willBeLearned
          ? { user_id: userId, word: key, learned_at: now }
          : { user_id: userId, word: key, learned_at: null, wrote_at: null };
        supabase
          .from("user_saves")
          .upsert(row, { onConflict: "user_id,word" })
          .then(({ error }) => {
            if (error) console.error("toggleLearned upsert failed:", error);
          });
      }
    },
    [userId],
  );

  // Toggle wrote (brush). Implies learned + saved — auto-saves and auto-caps
  // if not already. Turning OFF clears only wrote (cap and star stay).
  const toggleWrote = useCallback(
    (key: string) => {
      let willBeWrote = false;
      const now = Date.now();

      setItems((prev) => {
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, now);
        persistLocalMap(SAVED_KEY, next);
        return next;
      });
      setLearnedItems((prev) => {
        if (prev.has(key)) return prev;
        const next = new Map(prev);
        next.set(key, now);
        persistLocalMap(LEARNED_KEY, next);
        return next;
      });

      setWroteItems((prev) => {
        const next = new Map(prev);
        if (next.has(key)) {
          next.delete(key);
          willBeWrote = false;
        } else {
          next.set(key, now);
          willBeWrote = true;
        }
        persistLocalMap(WROTE_KEY, next);
        return next;
      });

      if (userId) {
        const iso = new Date(now).toISOString();
        const row = willBeWrote
          ? { user_id: userId, word: key, learned_at: iso, wrote_at: iso }
          : { user_id: userId, word: key, wrote_at: null };
        supabase
          .from("user_saves")
          .upsert(row, { onConflict: "user_id,word" })
          .then(({ error }) => {
            if (error) console.error("toggleWrote upsert failed:", error);
          });
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
        persistLocalMap(SAVED_KEY, next);
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
      persistLocalMap(SAVED_KEY, new Map());
      return new Map();
    });
    setLearnedItems(() => {
      persistLocalMap(LEARNED_KEY, new Map());
      return new Map();
    });
    setWroteItems(() => {
      persistLocalMap(WROTE_KEY, new Map());
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
      items: savedList.map((s) => ({
        word: s.word,
        savedAt: s.savedAt,
        learned: learnedItems.has(s.word),
        wrote: wroteItems.has(s.word),
      })),
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
  }, [savedList, learnedItems, wroteItems]);

  return {
    saved,
    savedList,
    learned,
    wrote,
    toggle,
    toggleLearned,
    toggleWrote,
    exportSaved,
    importSaved,
    clearAll,
    syncing,
  };
}
