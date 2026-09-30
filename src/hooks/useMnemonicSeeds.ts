import { useEffect, useState } from "react";

// Loads ./mnemonic-seeds.json — hand-written starter mnemonics for the
// HSK 3.0 level 1–3 characters (see scripts/test-mnemonics.mjs for the
// data contract). Fetched once per session (module-level cache: the
// consumer mounts per sheet-open, unlike the app-lifetime hooks).
// Soft-fails to an empty map so the formulaic starter still shows.

let cached: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

function load(): Promise<Record<string, string>> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = (async () => {
      try {
        const r = await fetch("./mnemonic-seeds.json", { cache: "force-cache" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        cached = (json.seeds || {}) as Record<string, string>;
      } catch (err) {
        console.warn("mnemonic-seeds load failed:", err);
        cached = {};
      }
      return cached;
    })();
  }
  return inflight;
}

export function useMnemonicSeeds(): Record<string, string> | null {
  const [seeds, setSeeds] = useState<Record<string, string> | null>(cached);

  useEffect(() => {
    if (seeds) return;
    let cancelled = false;
    void load().then((s) => {
      if (!cancelled) setSeeds(s);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return seeds;
}
