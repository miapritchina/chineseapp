import { useEffect, useRef } from "react";

// Drives reconcile() for cloud-synced hooks:
//   1. Fires once per userId (sign-in, account switch, sign-out → cleared)
//   2. Re-fires on tab focus / visibility, throttled to once per `throttleMs`
//
// Lifted from the identical effect pairs in useSaved, useMnemonics, and
// useReview. The reconcile callback should be memoized (useCallback) so
// effect deps stay stable.

const DEFAULT_THROTTLE_MS = 20_000;

export function useReconcileTriggers(
  userId: string | null,
  reconcile: () => Promise<void> | void,
  options?: { throttleMs?: number },
): void {
  const throttleMs = options?.throttleMs ?? DEFAULT_THROTTLE_MS;
  const lastSyncedUserRef = useRef<string | null>(null);
  const lastReconcileAtRef = useRef(0);

  // (1) Initial reconcile on sign-in / account switch.
  useEffect(() => {
    if (!userId) {
      lastSyncedUserRef.current = null;
      return;
    }
    if (lastSyncedUserRef.current === userId) return;
    lastSyncedUserRef.current = userId;
    lastReconcileAtRef.current = Date.now();
    void reconcile();
  }, [userId, reconcile]);

  // (2) Re-reconcile on tab focus, throttled.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastReconcileAtRef.current < throttleMs) return;
      lastReconcileAtRef.current = Date.now();
      void reconcile();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, reconcile, throttleMs]);
}
