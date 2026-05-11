import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { MnemonicEntry } from "../lib/mnemonics";

// Per-user mnemonic store. Supabase (`user_mnemonics`) is the source of
// truth; `localStorage` is an offline read-cache only. The cloud is
// reconciled on sign-in AND whenever the tab regains focus (throttled),
// so an edit made on another device shows up without a reload. Newer
// wins on per-key conflict (each row carries `updated_at`). Server
// failures degrade to the cache.

const KEY = "chinese.mnemonics.v1";
const NO_TABLE = /relation .*user_mnemonics.*does not exist/i;
// Don't re-fetch on every focus flicker — at most once per this window.
const RECONCILE_THROTTLE_MS = 20_000;

function loadLocal(): Map<string, MnemonicEntry> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const entries = Object.entries(parsed) as [string, MnemonicEntry][];
      return new Map(entries);
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

function persistLocal(map: Map<string, MnemonicEntry>) {
  try {
    const obj: Record<string, MnemonicEntry> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* quota / private mode */
  }
}

interface UseMnemonicsOpts {
  userId: string | null;
}

export function useMnemonics({ userId }: UseMnemonicsOpts) {
  const [entries, setEntries] = useState<Map<string, MnemonicEntry>>(() => loadLocal());
  const lastSyncedUserRef = useRef<string | null>(null);
  const lastReconcileAtRef = useRef(0);

  // Pull from the cloud and merge (newer-per-key wins); upload any local
  // entry the cloud doesn't have or that's strictly newer locally.
  const reconcile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("user_mnemonics")
      .select("key, text, edited, updated_at")
      .eq("user_id", userId);
    if (error) {
      if (!NO_TABLE.test(error.message || "")) {
        console.warn("user_mnemonics load failed:", error);
      }
      return;
    }
    lastReconcileAtRef.current = Date.now();
    type Row = { key: string; text: string; edited: boolean; updated_at: string };
    const remote = new Map<string, MnemonicEntry>();
    for (const r of (data || []) as Row[]) {
      remote.set(r.key, {
        text: r.text,
        edited: r.edited,
        updatedAt: new Date(r.updated_at).getTime(),
      });
    }
    let localBefore: Map<string, MnemonicEntry> = new Map();
    setEntries((prev) => {
      localBefore = prev;
      const merged = new Map(prev);
      for (const [k, r] of remote) {
        const p = merged.get(k);
        if (!p || r.updatedAt >= p.updatedAt) merged.set(k, r);
      }
      persistLocal(merged);
      return merged;
    });
    const toUpload: Array<{ key: string; entry: MnemonicEntry }> = [];
    for (const [k, p] of localBefore) {
      const r = remote.get(k);
      if (!r || p.updatedAt > r.updatedAt) toUpload.push({ key: k, entry: p });
    }
    if (toUpload.length > 0) {
      const rows = toUpload.map(({ key, entry }) => ({
        user_id: userId,
        key,
        text: entry.text,
        edited: entry.edited,
        updated_at: new Date(entry.updatedAt).toISOString(),
      }));
      const { error: upErr } = await supabase
        .from("user_mnemonics")
        .upsert(rows, { onConflict: "user_id,key" });
      if (upErr && !NO_TABLE.test(upErr.message || "")) {
        console.error("user_mnemonics upload failed:", upErr);
      }
    }
  }, [userId]);

  // Initial reconcile when a user signs in / switches accounts.
  useEffect(() => {
    if (!userId) {
      lastSyncedUserRef.current = null;
      return;
    }
    if (lastSyncedUserRef.current === userId) return;
    lastSyncedUserRef.current = userId;
    void reconcile();
  }, [userId, reconcile]);

  // Re-reconcile when the tab regains focus (cross-device freshness),
  // throttled so quick app-switches don't hammer the API.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastReconcileAtRef.current < RECONCILE_THROTTLE_MS) return;
      void reconcile();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, reconcile]);

  const get = useCallback(
    (key: string): MnemonicEntry | null => entries.get(key) ?? null,
    [entries],
  );

  const save = useCallback(
    (key: string, text: string) => {
      const now = Date.now();
      const next: MnemonicEntry = { text, edited: true, updatedAt: now };
      setEntries((prev) => {
        const m = new Map(prev);
        m.set(key, next);
        persistLocal(m);
        return m;
      });
      if (userId) {
        void supabase
          .from("user_mnemonics")
          .upsert(
            {
              user_id: userId,
              key,
              text,
              edited: true,
              updated_at: new Date(now).toISOString(),
            },
            { onConflict: "user_id,key" },
          )
          .then(({ error }) => {
            if (error && !NO_TABLE.test(error.message || "")) {
              console.error("user_mnemonics upsert failed:", error);
            }
          });
      }
    },
    [userId],
  );

  const clear = useCallback(
    (key: string) => {
      setEntries((prev) => {
        if (!prev.has(key)) return prev;
        const m = new Map(prev);
        m.delete(key);
        persistLocal(m);
        return m;
      });
      if (userId) {
        void supabase
          .from("user_mnemonics")
          .delete()
          .eq("user_id", userId)
          .eq("key", key)
          .then(({ error }) => {
            if (error && !NO_TABLE.test(error.message || "")) {
              console.error("user_mnemonics delete failed:", error);
            }
          });
      }
    },
    [userId],
  );

  return { get, save, clear };
}
