import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useReconcileTriggers } from "./useReconcileTriggers";

// Furthest-read couplet on the 三字经 page. Cloud-first per ADR-0001:
// Supabase row is authoritative, localStorage is the offline cache.
// "Furthest" merge rule — max(local, remote) — so re-reading earlier
// sections never loses the bookmark.

const KEY = "chinese.classicProgress";

function loadLocal(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY) ?? "", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function useClassicProgress(userId: string | null) {
  const [index, setIndex] = useState<number>(() => loadLocal());
  const indexRef = useRef(index);
  indexRef.current = index;
  const pushTimer = useRef<number | null>(null);

  const persist = useCallback(
    (next: number) => {
      try {
        localStorage.setItem(KEY, String(next));
      } catch {
        /* ignore */
      }
      if (!userId) return;
      // Throttle remote writes — scroll tracking calls this often.
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => {
        void supabase
          .from("user_classic_progress")
          .upsert(
            { user_id: userId, couplet_index: next, updated_at: new Date().toISOString() },
            { onConflict: "user_id" },
          )
          .then(({ error }) => {
            if (
              error &&
              !/relation .*user_classic_progress.*does not exist/i.test(error.message || "")
            ) {
              console.warn("classic progress upsert failed:", error);
            }
          });
      }, 2000);
    },
    [userId],
  );

  // Advance-only setter (furthest read wins).
  const advanceTo = useCallback(
    (next: number) => {
      if (next <= indexRef.current) return;
      setIndex(next);
      persist(next);
    },
    [persist],
  );

  const reconcile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("user_classic_progress")
      .select("couplet_index")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (!/relation .*user_classic_progress.*does not exist/i.test(error.message || "")) {
        console.warn("classic progress load failed:", error);
      }
      return;
    }
    const remote = data?.couplet_index ?? 0;
    if (remote > indexRef.current) {
      setIndex(remote);
      try {
        localStorage.setItem(KEY, String(remote));
      } catch {
        /* ignore */
      }
    } else if (remote < indexRef.current) {
      persist(indexRef.current);
    }
  }, [userId, persist]);

  useReconcileTriggers(userId, reconcile);

  useEffect(
    () => () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    },
    [],
  );

  return { index, advanceTo };
}
