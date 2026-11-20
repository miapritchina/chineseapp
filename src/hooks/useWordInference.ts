import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "../lib/types";
import { supabase } from "../lib/supabase";
import {
  inferenceAvailable,
  inferenceExclude,
  inferencePairs,
  knownChars,
  mergeInferenceOutcome,
  orderInferencePool,
  type InferenceOutcome,
} from "../lib/drillGen";

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
// Answer memory: `markSeen` records the outcome in localStorage
// immediately and useReview logs it to user_review_log; signed-in
// devices pull wordInference log rows back so it follows the account.
// A correct answer retires the word for good (v160); a miss rests for
// INFERENCE_COOLDOWN_DAYS before it may rotate back in.

const PROBE_CHUNK = 150;
// v166: the pool is the WHOLE set of 2–4 character words buildable from
// the user's characters (discover_words RPC, migration 0018). The
// server skips saved / retired / resting words, so each fetch is a
// window of the most common words not yet met — retire some and the
// next fetch reaches deeper. Fallbacks while a migration lags
// (ADR-0005): the v138 words_from_chars RPC (top-500 two-character
// words), then the v137 client-side pair probe.
const ALL_CHAR_CAP = 1200;
const WINDOW = 300;
const RPC_MAX = 500;
const FALLBACK_CHAR_CAP = 60;
// Chars from the most recent saves — words containing one lead the pool.
const RECENT_CHAR_COUNT = 20;
const SEEN_KEY = "chinese.inferenceSeen";
export const INFERENCE_COOLDOWN_DAYS = 14;
const COOLDOWN_MS = INFERENCE_COOLDOWN_DAYS * 86400000;

type Seen = Map<string, InferenceOutcome>;

function loadSeen(): Seen {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Map();
    // Pre-v160 entries are [word, ts] — no flag, so they only rest.
    const parsed = JSON.parse(raw) as { items?: [string, number, boolean?][] };
    const cutoff = Date.now() - COOLDOWN_MS;
    return new Map(
      (parsed.items ?? [])
        .filter(([w, ts, known]) => w && (known || ts > cutoff))
        .map(([w, ts, known]) => [w, { ts, known: !!known }]),
    );
  } catch {
    return new Map();
  }
}

function persistSeen(seen: Seen) {
  try {
    const items = [...seen.entries()].map(([w, o]) => [w, o.ts, o.known]);
    localStorage.setItem(SEEN_KEY, JSON.stringify({ items }));
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
  const [seen, setSeen] = useState<Seen>(() => loadSeen());
  const seenRef = useRef(seen);
  seenRef.current = seen;
  // Bumped when the account's answer history adds to what this device
  // knew — the pool is then re-fetched with the fuller skip list.
  const [seenEpoch, setSeenEpoch] = useState(0);
  const probedForRef = useRef<string>("");
  // Fresh rotation each app session — a fixed slice showed the same
  // words every time (owner-reported bug). Ref so the order is stable
  // WITHIN the session even as the memo recomputes.
  const rotationRef = useRef(Math.random());

  // Answered now → out of the pool now AND after exiting/reloading.
  const markSeen = useCallback((word: string, gotIt: boolean) => {
    setSeen((prev) => {
      const next = new Map(prev);
      next.set(word, mergeInferenceOutcome(prev.get(word), { ts: Date.now(), known: gotIt }));
      persistSeen(next);
      return next;
    });
  }, []);

  // Signed-in: merge wordInference outcomes from the review log so
  // retired words and resting misses follow the account across devices.
  // Correct answers are read all-time; misses only within the cooldown.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const base = () =>
        supabase
          .from("user_review_log")
          .select("item_key, reviewed_at, rating")
          .eq("user_id", userId)
          .eq("facet", "wordInference");
      const [known, recent] = await Promise.all([
        base().eq("rating", "Good"),
        base().gte("reviewed_at", since),
      ]);
      if (known.error || recent.error) return; // missing table → degrade silently
      const rows = [...(known.data ?? []), ...(recent.data ?? [])];
      const merge = (prev: Seen): Seen | null => {
        let changed = false;
        const next = new Map(prev);
        for (const r of rows) {
          const cur = next.get(r.item_key);
          const merged = mergeInferenceOutcome(cur, {
            ts: new Date(r.reviewed_at).getTime(),
            known: r.rating === "Good",
          });
          if (!cur || cur.ts !== merged.ts || cur.known !== merged.known) {
            next.set(r.item_key, merged);
            changed = true;
          }
        }
        return changed ? next : null;
      };
      if (!merge(seenRef.current)) return;
      setSeen((prev) => {
        const next = merge(prev);
        if (!next) return prev;
        persistSeen(next);
        return next;
      });
      setSeenEpoch((e) => e + 1);
    })();
  }, [userId]);

  useEffect(() => {
    // Most-recently-saved first so fresh vocabulary wins the char cap.
    const words = savedList
      .slice()
      .sort((a, b) => b.savedAt - a.savedAt)
      .map((s) => s.word);
    const signature = `${words.join("")}|${seenEpoch}`;
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
      const allChars = knownChars(words, ALL_CHAR_CAP);
      const exclude = inferenceExclude(words, seenRef.current, Date.now(), COOLDOWN_MS);
      let { data, error } = await supabase.rpc("discover_words", {
        chars: allChars,
        exclude,
        max_results: WINDOW,
      });
      if (error) {
        ({ data, error } = await supabase.rpc("words_from_chars", {
          chars: allChars,
          max_results: RPC_MAX,
        }));
      }
      if (!error && Array.isArray(data)) {
        const keys = (data as { word: string }[]).map((r) => r.word);
        for (let i = 0; i < keys.length; i += PROBE_CHUNK) {
          if (probedForRef.current !== signature) return;
          await ensureCached(keys.slice(i, i + PROBE_CHUNK));
        }
        if (probedForRef.current === signature) setProbedKeys(keys);
        return;
      }
      // Last resort: the v137 client-side pair probe over recent
      // characters.
      const candidates = inferencePairs(words, FALLBACK_CHAR_CAP);
      for (let i = 0; i < candidates.length; i += PROBE_CHUNK) {
        if (probedForRef.current !== signature) return;
        await ensureCached(candidates.slice(i, i + PROBE_CHUNK));
      }
      if (probedForRef.current === signature) setProbedKeys(candidates);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedList, seenEpoch]);

  const words = useMemo<Word[]>(() => {
    if (probedKeys.length === 0) return [];
    const saved = new Set(savedList.map((s) => s.word));
    const now = Date.now();
    const found = probedKeys
      .map((k) => findWord(k))
      .filter(
        (w): w is Word =>
          !!w && !saved.has(w.word) && inferenceAvailable(seen.get(w.word), now, COOLDOWN_MS),
      );
    // Fresh×old combinations lead (v138), then common words; rotate by
    // a per-session random offset so each session starts somewhere new
    // without the order jumping mid-session (a shuffle here would
    // reorder whenever the dictionary cache updates).
    const recentChars = new Set(
      knownChars(
        savedList
          .slice()
          .sort((a, b) => b.savedAt - a.savedAt)
          .map((s) => s.word),
        RECENT_CHAR_COUNT,
      ),
    );
    const ordered = orderInferencePool(found, recentChars);
    const capped = ordered.slice(0, WINDOW);
    if (capped.length === 0) return [];
    const offset = Math.floor(rotationRef.current * capped.length) % capped.length;
    return [...capped.slice(offset), ...capped.slice(0, offset)];
  }, [probedKeys, findWord, savedList, seen]);

  return { words, markSeen };
}
