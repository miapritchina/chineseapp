import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "chinese.saved";

function loadLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function persistLocal(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* private mode / quota — silent */
  }
}

interface UseSavedOpts {
  userId: string | null;
}

// Saved words live in two places when signed in: localStorage (for offline
// resilience and to survive sign-out) and the per-user `user_saves` table.
//
//   Signed out  → reads/writes localStorage only.
//   Signed in   → on first sync: union localStorage + DB; upload anything
//                 local-only to the DB; mirror DB-only down to local.
//                 Every subsequent toggle writes through to both.
//   Sign out    → keeps the localStorage copy as-is.
export function useSaved({ userId }: UseSavedOpts) {
  const [saved, setSaved] = useState<Set<string>>(() => loadLocal());
  const [syncing, setSyncing] = useState(false);
  const lastSyncedUserRef = useRef<string | null>(null);

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
      const local = loadLocal();
      const { data, error } = await supabase
        .from("user_saves")
        .select("word")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) {
        console.error("user_saves load failed:", error);
        setSyncing(false);
        return;
      }
      const remote = new Set<string>((data || []).map((r: { word: string }) => r.word));

      const toUpload = [...local].filter((w) => !remote.has(w));
      if (toUpload.length > 0) {
        const { error: upErr } = await supabase
          .from("user_saves")
          .upsert(
            toUpload.map((w) => ({ user_id: userId, word: w })),
            { onConflict: "user_id,word" },
          );
        if (upErr) console.error("user_saves upload failed:", upErr);
      }

      const union = new Set<string>([...local, ...remote]);
      persistLocal(union);
      if (cancelled) return;
      setSaved(union);
      setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    (key: string) => {
      let willBeSaved = false;
      setSaved((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
          willBeSaved = false;
        } else {
          next.add(key);
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
    async (items: string[]): Promise<{ added: number; total: number }> => {
      const total = items.length;
      if (!total) return { added: 0, total: 0 };
      let added = 0;
      setSaved((prev) => {
        const next = new Set(prev);
        for (const w of items) {
          if (!next.has(w)) added++;
          next.add(w);
        }
        persistLocal(next);
        return next;
      });
      // If signed in, upload everything (idempotent on PK).
      if (userId) {
        const rows = items.map((w) => ({ user_id: userId, word: w }));
        const { error } = await supabase
          .from("user_saves")
          .upsert(rows, { onConflict: "user_id,word" });
        if (error) console.error("import upload failed:", error);
      }
      return { added, total };
    },
    [userId],
  );

  const exportSaved = useCallback(() => {
    const items = [...saved];
    if (!items.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      app: "chinese",
      exported: new Date().toISOString(),
      count: items.length,
      saved: items,
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
  }, [saved]);

  return { saved, toggle, exportSaved, importSaved, syncing };
}
