import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { MnemonicEntry } from "../lib/mnemonics";

// Per-user mnemonic store. Mirrors the useSaved / useReview pattern:
// localStorage as source-of-truth offline, Supabase as cross-device
// sync when signed in. Server failures degrade to local-only.

const KEY = "chinese.mnemonics.v1";

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

  // Initial sync when a user signs in / switches accounts.
  useEffect(() => {
    if (!userId) {
      lastSyncedUserRef.current = null;
      return;
    }
    if (lastSyncedUserRef.current === userId) return;
    lastSyncedUserRef.current = userId;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_mnemonics")
        .select("key, text, edited, updated_at")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) {
        // Migration not applied yet → degrade silently.
        if (!/relation .*user_mnemonics.*does not exist/i.test(error.message || "")) {
          console.warn("user_mnemonics load failed:", error);
        }
        return;
      }
      type Row = { key: string; text: string; edited: boolean; updated_at: string };
      const remote = new Map<string, MnemonicEntry>();
      for (const r of (data || []) as Row[]) {
        remote.set(r.key, {
          text: r.text,
          edited: r.edited,
          updatedAt: new Date(r.updated_at).getTime(),
        });
      }
      // Conflict resolution: newer wins (per-key updatedAt).
      setEntries((prev) => {
        const merged = new Map(prev);
        for (const [k, r] of remote) {
          const p = merged.get(k);
          if (!p || r.updatedAt > p.updatedAt) merged.set(k, r);
        }
        persistLocal(merged);
        return merged;
      });
      // Upload local entries the remote didn't have (or that are
      // strictly newer locally).
      const toUpload: Array<{ key: string; entry: MnemonicEntry }> = [];
      for (const [k, p] of entries) {
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
        if (upErr && !/relation .*user_mnemonics.*does not exist/i.test(upErr.message || "")) {
          console.error("user_mnemonics upload failed:", upErr);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
            if (error && !/relation .*user_mnemonics.*does not exist/i.test(error.message || "")) {
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
            if (error && !/relation .*user_mnemonics.*does not exist/i.test(error.message || "")) {
              console.error("user_mnemonics delete failed:", error);
            }
          });
      }
    },
    [userId],
  );

  return { get, save, clear };
}
