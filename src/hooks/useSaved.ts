import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { loadTimestampMap, persistTimestampMap } from "../lib/localCache";
import { useReconcileTriggers } from "./useReconcileTriggers";

const SAVED_KEY = "chinese.saved";
const LEARNED_KEY = "chinese.learned";
const WROTE_KEY = "chinese.wrote";
const REVIEW_KEY = "chinese.review";

export type Status = "saved" | "learned" | "wrote" | "review";

export interface SavedEntry {
  word: string;
  savedAt: number;
}

const loadLocalMap = loadTimestampMap;
const persistLocalMap = persistTimestampMap;

interface UseSavedOpts {
  userId: string | null;
}

// Four mutually-exclusive statuses for any saved word:
//   ★  saved    (the base — set by saved_at; no other tier set)
//   🎓 learned  (learned_at IS NOT NULL)
//   ✒  wrote    (wrote_at IS NOT NULL)
//   ❗ review   (review_at IS NOT NULL — "needs another look")
//
// At most one of {learned_at, wrote_at, review_at} is non-null at a time.
// Supabase (`user_saves`) is the source of truth; the four localStorage
// maps are an offline read-cache. The cloud is reconciled on sign-in AND
// whenever the tab regains focus (throttled), so a change made on another
// device flows in without a reload.
export function useSaved({ userId }: UseSavedOpts) {
  const [items, setItems] = useState<Map<string, number>>(() => loadLocalMap(SAVED_KEY));
  const [learnedItems, setLearnedItems] = useState<Map<string, number>>(() =>
    loadLocalMap(LEARNED_KEY),
  );
  const [wroteItems, setWroteItems] = useState<Map<string, number>>(() => loadLocalMap(WROTE_KEY));
  const [reviewItems, setReviewItems] = useState<Map<string, number>>(() =>
    loadLocalMap(REVIEW_KEY),
  );
  const [syncing, setSyncing] = useState(false);

  // Read-only views.
  const saved = useMemo(() => new Set(items.keys()), [items]);
  const learned = useMemo(() => new Set(learnedItems.keys()), [learnedItems]);
  const wrote = useMemo(() => new Set(wroteItems.keys()), [wroteItems]);
  const review = useMemo(() => new Set(reviewItems.keys()), [reviewItems]);
  const savedList = useMemo<SavedEntry[]>(
    () =>
      [...items.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([word, savedAt]) => ({ word, savedAt })),
    [items],
  );

  // Resolve a word's current status. v99 collapsed the UI to two tiers
  // (ADR-0011): legacy "wrote" rows read as learned, legacy "review"
  // rows as saved. The underlying columns/sets stay (additive policy)
  // so nothing is lost if the tiers ever come back.
  const getStatus = useCallback(
    (key: string): Status | null => {
      if (!items.has(key)) return null;
      if (wroteItems.has(key) || learnedItems.has(key)) return "learned";
      return "saved";
    },
    [items, wroteItems, learnedItems],
  );

  // Pull from Supabase and merge: remote wins on overlap (the DB is the
  // source of truth); local rows the DB doesn't have are uploaded (covers
  // pre-account / offline edits). Called on sign-in and on tab focus.
  const reconcile = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    type FullRow = {
      word: string;
      saved_at: string;
      learned_at: string | null;
      wrote_at: string | null;
      review_at: string | null;
    };
    type LegacyRow = Omit<FullRow, "review_at">;
    let rows: FullRow[] = [];
    {
      const { data, error } = await supabase
        .from("user_saves")
        .select("word, saved_at, learned_at, wrote_at, review_at")
        .eq("user_id", userId);
      if (error) {
        console.warn("user_saves wide select failed, falling back without review_at:", error);
        const fallback = await supabase
          .from("user_saves")
          .select("word, saved_at, learned_at, wrote_at")
          .eq("user_id", userId);
        if (fallback.error) {
          console.error("user_saves load failed:", fallback.error);
          setSyncing(false);
          return;
        }
        rows = (fallback.data as LegacyRow[]).map((r) => ({ ...r, review_at: null }));
      } else {
        rows = (data || []) as FullRow[];
      }
    }

    const remoteSaved = new Map<string, number>();
    const remoteLearned = new Map<string, number>();
    const remoteWrote = new Map<string, number>();
    const remoteReview = new Map<string, number>();
    for (const r of rows) {
      remoteSaved.set(r.word, new Date(r.saved_at).getTime());
      if (r.wrote_at) remoteWrote.set(r.word, new Date(r.wrote_at).getTime());
      else if (r.learned_at) remoteLearned.set(r.word, new Date(r.learned_at).getTime());
      else if (r.review_at) remoteReview.set(r.word, new Date(r.review_at).getTime());
    }

    let localSavedBefore: Map<string, number> = new Map();
    let localLearnedBefore: Map<string, number> = new Map();
    let localWroteBefore: Map<string, number> = new Map();
    let localReviewBefore: Map<string, number> = new Map();

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
    setReviewItems((prev) => {
      localReviewBefore = prev;
      const merged = new Map(prev);
      for (const [word, ts] of remoteReview) merged.set(word, ts);
      persistLocalMap(REVIEW_KEY, merged);
      return merged;
    });

    const allLocalKeys = new Set<string>([
      ...localSavedBefore.keys(),
      ...localLearnedBefore.keys(),
      ...localWroteBefore.keys(),
      ...localReviewBefore.keys(),
    ]);
    const toUpload = [...allLocalKeys].filter(
      (w) =>
        !remoteSaved.has(w) ||
        (localLearnedBefore.has(w) && !remoteLearned.has(w)) ||
        (localWroteBefore.has(w) && !remoteWrote.has(w)) ||
        (localReviewBefore.has(w) && !remoteReview.has(w)),
    );
    if (toUpload.length > 0) {
      const now = new Date().toISOString();
      const uploadRows = toUpload.map((w) => ({
        user_id: userId,
        word: w,
        ...(localLearnedBefore.has(w) ? { learned_at: now } : {}),
        ...(localWroteBefore.has(w) ? { wrote_at: now } : {}),
        ...(localReviewBefore.has(w) ? { review_at: now } : {}),
      }));
      const { error: upErr } = await supabase
        .from("user_saves")
        .upsert(uploadRows, { onConflict: "user_id,word" });
      if (upErr) console.error("user_saves upload failed:", upErr);
    }
    setSyncing(false);
  }, [userId]);

  useReconcileTriggers(userId, reconcile);

  // Single setter for the new mutually-exclusive status model.
  // Pass null to remove the word entirely.
  const setStatus = useCallback(
    (key: string, next: Status | null) => {
      const now = Date.now();

      if (next === null) {
        setItems((prev) => {
          if (!prev.has(key)) return prev;
          const m = new Map(prev);
          m.delete(key);
          persistLocalMap(SAVED_KEY, m);
          return m;
        });
        setLearnedItems((prev) => {
          if (!prev.has(key)) return prev;
          const m = new Map(prev);
          m.delete(key);
          persistLocalMap(LEARNED_KEY, m);
          return m;
        });
        setWroteItems((prev) => {
          if (!prev.has(key)) return prev;
          const m = new Map(prev);
          m.delete(key);
          persistLocalMap(WROTE_KEY, m);
          return m;
        });
        setReviewItems((prev) => {
          if (!prev.has(key)) return prev;
          const m = new Map(prev);
          m.delete(key);
          persistLocalMap(REVIEW_KEY, m);
          return m;
        });
        if (userId) {
          supabase
            .from("user_saves")
            .delete()
            .eq("user_id", userId)
            .eq("word", key)
            .then(({ error }) => error && console.error("delete user_saves failed:", error));
        }
        return;
      }

      // Ensure the word is in the saved map.
      setItems((prev) => {
        if (prev.has(key)) return prev;
        const m = new Map(prev);
        m.set(key, now);
        persistLocalMap(SAVED_KEY, m);
        return m;
      });

      // Mutually-exclusive higher tiers.
      const set = (
        match: Status,
        prevMap: Map<string, number>,
        setter: typeof setItems,
        storageKey: string,
      ) => {
        const want = next === match;
        const has = prevMap.has(key);
        if (want === has) return;
        setter((prev) => {
          const m = new Map(prev);
          if (want) m.set(key, now);
          else m.delete(key);
          persistLocalMap(storageKey, m);
          return m;
        });
      };
      set("learned", learnedItems, setLearnedItems, LEARNED_KEY);
      set("wrote", wroteItems, setWroteItems, WROTE_KEY);
      set("review", reviewItems, setReviewItems, REVIEW_KEY);

      if (userId) {
        const iso = new Date(now).toISOString();
        const row: Record<string, string | null> = {
          user_id: userId,
          word: key,
          learned_at: next === "learned" ? iso : null,
          wrote_at: next === "wrote" ? iso : null,
          review_at: next === "review" ? iso : null,
        };
        supabase
          .from("user_saves")
          .upsert(row, { onConflict: "user_id,word" })
          .then(({ error }) => {
            if (error) {
              // If review_at column hasn't been added yet, retry without it
              // so the user's local state still mirrors as best it can.
              if (
                /column .*review_at/i.test(error.message || "") ||
                /could not find the .* column/i.test(error.message || "")
              ) {
                const { review_at: _ignored, ...rest } = row;
                void supabase
                  .from("user_saves")
                  .upsert(rest, { onConflict: "user_id,word" })
                  .then(({ error: err2 }) => {
                    if (err2) console.error("setStatus upsert (fallback) failed:", err2);
                  });
              } else {
                console.error("setStatus upsert failed:", error);
              }
            }
          });
      }
    },
    [userId, learnedItems, wroteItems, reviewItems],
  );

  // Backwards-compat thin wrappers — older call-sites use these. Kept so the
  // refactor doesn't have to touch every component at once. Toggling now
  // means: if not in that tier → set the matching status; if in it → drop
  // back to "saved" (or remove entirely for the star toggle).
  const toggle = useCallback(
    (key: string) => {
      setStatus(key, items.has(key) ? null : "saved");
    },
    [setStatus, items],
  );
  const toggleLearned = useCallback(
    (key: string) => {
      setStatus(key, learnedItems.has(key) ? "saved" : "learned");
    },
    [setStatus, learnedItems],
  );
  const toggleWrote = useCallback(
    (key: string) => {
      setStatus(key, wroteItems.has(key) ? "saved" : "wrote");
    },
    [setStatus, wroteItems],
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
    setReviewItems(() => {
      persistLocalMap(REVIEW_KEY, new Map());
      return new Map();
    });
    if (userId) {
      const { error } = await supabase.from("user_saves").delete().eq("user_id", userId);
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
        status: getStatus(s.word),
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
  }, [savedList, getStatus]);

  return {
    saved,
    savedList,
    learned,
    wrote,
    review,
    getStatus,
    setStatus,
    toggle,
    toggleLearned,
    toggleWrote,
    exportSaved,
    importSaved,
    clearAll,
    syncing,
  };
}
