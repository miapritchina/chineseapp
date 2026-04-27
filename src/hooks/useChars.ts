import { useEffect, useState } from "react";
import type { Char, DataChars } from "../lib/types";

export function useChars(): { chars: Record<string, Char>; ready: boolean } {
  const [chars, setChars] = useState<Record<string, Char>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("./data-chars.json", { cache: "no-cache" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: DataChars = await resp.json();
        if (cancelled) return;
        setChars(data.chars);
        setReady(true);
      } catch (err) {
        // Soft fail — modal/tree will still render with placeholders.
        console.error("chars load failed:", err);
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { chars, ready };
}
