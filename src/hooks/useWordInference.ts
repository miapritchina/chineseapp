import { useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "../lib/types";
import { inferencePairs } from "../lib/drillGen";

// Discovers real, unsaved words built entirely from characters the
// user already knows (drill 1 — see docs/product/recognition-drills.md).
// Probes candidate char pairs against the dictionary via ensureCached
// (batched; results land in the dictionary's own cache).
//
// Two-step shape on purpose: the effect only PROBES and records which
// candidates were probed; the pool derives in a memo keyed on the
// CURRENT findWord. Deriving inside the effect would read a findWord
// closed over the pre-probe cache and always come up empty (the same
// stale-dict-closure trap as the v90 search hang).

const PROBE_CHUNK = 150;
const POOL_CAP = 30;

interface Opts {
  savedList: { word: string; savedAt: number }[];
  ensureCached: (words: string[]) => Promise<void>;
  findWord: (key: string) => Word | null;
}

export function useWordInference({ savedList, ensureCached, findWord }: Opts) {
  const [probedKeys, setProbedKeys] = useState<string[]>([]);
  const probedForRef = useRef<string>("");
  // Fresh rotation each app session — a fixed slice showed the same
  // words every time (owner-reported bug). Ref so the order is stable
  // WITHIN the session even as the memo recomputes.
  const rotationRef = useRef(Math.random());

  useEffect(() => {
    // Most-recently-saved first so fresh vocabulary wins the char cap.
    const words = savedList
      .slice()
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((s) => s.word);
    const signature = words.join("");
    if (signature === probedForRef.current) return;
    probedForRef.current = signature;
    if (words.length < 2) {
      setProbedKeys([]);
      return;
    }

    // Staleness is judged against the signature ref, NOT an effect
    // cleanup flag: savedList gets a fresh identity on unrelated
    // re-renders, which re-runs this effect (the guard above skips the
    // re-probe) — a cleanup-based cancel would kill the in-flight probe
    // it just deduplicated against.
    void (async () => {
      const candidates = inferencePairs(words);
      for (let i = 0; i < candidates.length; i += PROBE_CHUNK) {
        if (probedForRef.current !== signature) return;
        await ensureCached(candidates.slice(i, i + PROBE_CHUNK));
      }
      if (probedForRef.current === signature) setProbedKeys(candidates);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedList]);

  return useMemo<Word[]>(() => {
    if (probedKeys.length === 0) return [];
    const saved = new Set(savedList.map((s) => s.word));
    const found = probedKeys
      .map((k) => findWord(k))
      .filter((w): w is Word => !!w && !saved.has(w.word));
    // Common words first; rotate by a per-session random offset so
    // each session starts somewhere new without the order jumping
    // mid-session (a shuffle here would reorder whenever the
    // dictionary cache updates).
    found.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    const capped = found.slice(0, POOL_CAP);
    if (capped.length === 0) return [];
    const offset = Math.floor(rotationRef.current * capped.length);
    return [...capped.slice(offset), ...capped.slice(0, offset)];
  }, [probedKeys, findWord, savedList]);
}
