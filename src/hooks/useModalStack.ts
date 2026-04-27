import { useCallback, useEffect, useState } from "react";
import type { ModalEntry } from "../lib/types";

function locationFor(e: ModalEntry): string {
  return `#/${e.kind === "word" ? "w" : "c"}/${encodeURIComponent(e.key)}`;
}

export function parseHash(): ModalEntry | null {
  const m = /^#\/(w|c)\/(.+)$/.exec(location.hash);
  return m ? { kind: m[1] === "w" ? "word" : "char", key: decodeURIComponent(m[2]) } : null;
}

export function useModalStack() {
  const [stack, setStack] = useState<ModalEntry[]>([]);

  const push = useCallback((entry: ModalEntry) => {
    setStack((prev) => {
      const next = [...prev, entry];
      history.pushState({ stackLen: next.length }, "", locationFor(entry));
      return next;
    });
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      // Always go back in history; popstate handler keeps state consistent.
      if (history.state?.stackLen) history.back();
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setStack([]);
  }, []);

  useEffect(() => {
    const onPop = (ev: PopStateEvent) => {
      const desiredLen = (ev.state as { stackLen?: number } | null)?.stackLen ?? 0;
      setStack((prev) => (prev.length > desiredLen ? prev.slice(0, desiredLen) : prev));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && stack.length > 0) pop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stack.length, pop]);

  return { stack, push, pop, close };
}
