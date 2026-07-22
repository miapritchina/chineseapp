import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "../lib/types";
import { supabase } from "../lib/supabase";
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
//
// Answered words are DONE across sessions: `markSeen` records them in
// localStorage immediately and useReview logs the outcome to
// user_review_log; signed-in devices pull recent wordInference log
// rows back so the rest-period follows the account. A word rests for
// INFERENCE_COOLDOWN_DAYS before it may rotate back in.

const PROBE_CHUNK = 150;
const POOL_CAP = 30;
const SEEN_KEY = "chinese.inferenceSeen";
export const INFERENCE_COOLDOWN_DAYS = 14;
const COOLDOWN_MS = INFERENCE_COOLDOWN_DAYS * 86400000;

function loadSeen(): Map<string, number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as { items?: [string, number][] };
    const cutoff = Date.now() - COOLDOWN_MS;
    return new Map((parsed.items ?? []).filter(([w, ts]) => w && ts > cutoff));
  } catch {
    return new Map();
  }
}

function persistSeen(seen: Map<string, number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ items: [...seen.entries()] }));
  } catch {
    /* ignore */
  }
}

interface Opts {
  userId: string | null;
  savedList: { word: string; savedAt: number }[];
  ensureCached: (words: string[]) => Promise<void>;
  findWord: (key: string) => Word | null;
}

export function useWordInference({ userId, savedList, ensureCached, findWord }: Opts) {
  const [probedKeys, setProbedKeys] = useState<string[]>([]);
  const [seen, setSeen] = useState<Map<string, number>>(() => loadSeen());
  const probedForRef = useRef<string>("");
  // Fresh rotation each app session — a fixed slice showed the same
  // words every time (owner-reported bug). Ref so the order is stable
  // WITHIN the session even as the memo recomputes.
  const rotationRef = useRef(Math.random());

  // Answered now → out of the pool now AND after exiting/reloading.
  const markSeen = useCallback((word: string) => {
    setSeen((prev) => {
      const next = new Map(prev);
      next.set(word, Date.now());
      persistSeen(next);
      return next;
    });
  }, []);

  // Signed-in: merge recent wordInference outcomes from the review log
  // so the rest-period follows the account across devices.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const { data, error } = await supabase
        .from("user_review_log")
        .select("item_key, reviewed_at")
        .eq("user_id", userId)
        .eq("facet", "wordInference")
        .gte("reviewed_at", since);
      if (error || !data) return; // missing table → degrade silently
      setSeen((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const r of data) {
          const ts = new Date(r.reviewed_at).getTime();
          if ((next.get(r.item_key) ?? 0) < ts) {
            next.set(r.item_key, ts);
            changed = true;
          }
        }
        if (!changed) return prev;
        persistSeen(next);
        return next;
      });
    })();
  }, [userId]);

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

  const words = useMemo<Word[]>(() => {
    if (probedKeys.length === 0) return [];
    const saved = new Set(savedList.map((s) => s.word));
    const cutoff = Date.now() - COOLDOWN_MS;
    const found = probedKeys
      .map((k) => findWord(k))
      .filter((w): w is Word => !!w && !saved.has(w.word) && (seen.get(w.word) ?? 0) <= cutoff);
    // Common words first; rotate by a per-session random offset so
    // each session starts somewhere new without the order jumping
    // mid-session (a shuffle here would reorder whenever the
    // dictionary cache updates).
    found.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    const capped = found.slice(0, POOL_CAP);
    if (capped.length === 0) return [];
    const offset = Math.floor(rotationRef.current * capped.length) % capped.length;
    return [...capped.slice(offset), ...capped.slice(0, offset)];
  }, [probedKeys, findWord, savedList, seen]);

  return { words, markSeen };
}
