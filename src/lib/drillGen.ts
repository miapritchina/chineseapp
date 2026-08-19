// Pure material-generation helpers for the v98 recognition drills.
// No React, no IO — everything takes data in and returns data out so
// the rules are unit-testable. Callers pass `rand` for deterministic
// tests; production uses Math.random.

export type Rand = () => number;

export function shuffle<T>(arr: T[], rand: Rand = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

// Distinct characters across the saved words, preserving first-seen
// order (callers pass most-recently-saved first so fresh material
// wins the cap).
export function knownChars(savedWords: string[], cap = 36): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of savedWords) {
    for (const c of w) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

// Candidate two-char strings for the new-word inference drill: every
// ordered pair of known characters that is not itself a saved word.
// The dictionary probe (ensureCached) decides which are real words.
export function inferencePairs(savedWords: string[], capChars = 36): string[] {
  const chars = knownChars(savedWords, capChars);
  const saved = new Set(savedWords);
  const out: string[] = [];
  for (const a of chars) {
    for (const b of chars) {
      if (a === b) continue;
      const cand = a + b;
      if (saved.has(cand)) continue;
      out.push(cand);
    }
  }
  return out;
}

// Reverse recognition: the answer plus up to n-1 saved-word
// distractors, scored to be confusable — sharing a character with the
// answer, matching its length, and (when char data is available via
// componentsOf) sharing a component. Ties break randomly. Returns
// null when there aren't at least 2 options.
export function pickReverseOptions(
  answer: string,
  savedWords: string[],
  n = 4,
  rand: Rand = Math.random,
  componentsOf?: (char: string) => string[],
): string[] | null {
  const answerChars = new Set([...answer]);
  const answerLen = [...answer].length;
  const answerComps = new Set<string>();
  if (componentsOf) {
    for (const c of answer) for (const p of componentsOf(c)) if (p) answerComps.add(p);
  }
  const pool = savedWords.filter((w) => w !== answer);
  // Shuffle BEFORE the stable sort so equal scores come out in random
  // order — otherwise every session shows the same distractors.
  const scored = shuffle(pool, rand).map((w) => {
    let score = 0;
    if ([...w].some((c) => answerChars.has(c))) score += 3;
    if ([...w].length === answerLen) score += 2;
    if (answerComps.size > 0 && componentsOf) {
      // Only unshared chars count here — a shared char would make
      // component overlap a given, not an extra confusion signal.
      const sharesComp = [...w].some(
        (c) => !answerChars.has(c) && componentsOf(c).some((p) => p && answerComps.has(p)),
      );
      if (sharesComp) score += 2;
    }
    return { w, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const distractors = scored.slice(0, n - 1).map((s) => s.w);
  if (distractors.length < 1) return null;
  return shuffle([answer, ...distractors], rand);
}

export interface ClozeTask {
  maskIndex: number;
  answer: string;
  options: string[];
}

// Masked-char cloze: mask one character of a multi-char word; options
// are the answer plus distractors from its confusion cluster, padded
// with characters from the user's other saved words.
export function pickClozeTask(
  word: string,
  savedWords: string[],
  clusterFor: (char: string) => string[] | null,
  rand: Rand = Math.random,
): ClozeTask | null {
  const glyphs = [...word];
  if (glyphs.length < 2) return null;
  const maskIndex = Math.floor(rand() * glyphs.length);
  const answer = glyphs[maskIndex];
  const inWord = new Set(glyphs);
  const cluster = (clusterFor(answer) ?? []).filter((c) => c !== answer && !inWord.has(c));
  const padPool = knownChars(savedWords, 100).filter((c) => !inWord.has(c) && !cluster.includes(c));
  const distractors = [...shuffle(cluster, rand), ...shuffle(padPool, rand)].slice(0, 3);
  if (distractors.length < 1) return null;
  return { maskIndex, answer, options: shuffle([answer, ...distractors], rand) };
}

// New-word inference: 4 meaning options (the correct gloss + distinct
// distractor glosses from the pool). Null when the pool can't supply
// at least one distractor.
export function pickGlossOptions(
  correct: string,
  pool: string[],
  n = 4,
  rand: Rand = Math.random,
): string[] | null {
  const distractors = shuffle([...new Set(pool.filter((g) => g && g !== correct))], rand).slice(
    0,
    n - 1,
  );
  if (distractors.length < 1) return null;
  return shuffle([correct, ...distractors], rand);
}

// Partition the WHOLE saved set into recall clusters (each word used at
// most once per session):
//   1. Phonetic-component families (e.g. 请/情/清 words).
//   2. Shared-character groups among what's left.
//   3. Random leftover groups.
// Groups of 3–4; singletons/pairs left over are dropped. Cluster order
// is shuffled so sessions don't always start with the same family.
export function buildClusters(
  savedKeys: string[],
  phoneticComponentsByChar?: Map<string, { char: string; family: string[] }> | null,
  rand: Rand = Math.random,
): string[][] {
  const TARGET = 4;
  const MIN = 3;
  const unused = new Set(savedKeys);
  const clusters: string[][] = [];

  const take = (members: string[]) => {
    const group = members.slice(0, TARGET);
    for (const w of group) unused.delete(w);
    clusters.push(group);
  };

  if (phoneticComponentsByChar) {
    for (const [comp, info] of phoneticComponentsByChar) {
      const family = new Set(info.family || []);
      family.add(comp);
      const matches = [...unused].filter((w) => [...w].some((c) => family.has(c)));
      if (matches.length >= MIN) take(matches);
    }
  }

  // Shared-character groups among the remainder, biggest first, until
  // nothing groups any more.
  for (;;) {
    const counts = new Map<string, string[]>();
    for (const w of unused) {
      for (const c of new Set(w)) {
        const arr = counts.get(c) || [];
        arr.push(w);
        counts.set(c, arr);
      }
    }
    const best = [...counts.values()]
      .filter((ws) => ws.length >= MIN)
      .sort((a, b) => b.length - a.length)[0];
    if (!best) break;
    take(best);
  }

  // Random leftover groups (≥3 only).
  const rest = shuffle([...unused], rand);
  for (let i = 0; i + MIN <= rest.length; i += TARGET) {
    const group = rest.slice(i, i + TARGET);
    if (group.length >= MIN) clusters.push(group);
  }

  return shuffle(clusters, rand);
}

// Interleave due cards across activity types — round-robin over facet
// groups so a session mixes drills instead of running each type to
// exhaustion (owner request, v106). NOT a shuffle: within each group
// the most overdue card stays first, and the rotation leads with the
// group holding the most overdue card overall. wordInference and
// clusterRecall rows are synthetic (dueAt 0), so they always rotate
// last.
const SYNTHETIC_FACETS = new Set(["wordInference", "clusterRecall", "familySweep"]);

export function interleaveByActivity<T extends { facet: string; dueAt: number }>(
  rows: T[],
  // Urgent rows (v136: words containing a problem character) lead
  // their group regardless of due date — attention goes to the words
  // most likely to fail first.
  isUrgent?: (row: T) => boolean,
): T[] {
  const keyOf = (f: string) =>
    f === "meaningRecognition" || f === "soundRecognition" || f === "recognition"
      ? "recognition"
      : f;
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r.facet);
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const u = (r: T) => (isUrgent?.(r) ? 1 : 0);
  for (const g of groups.values()) g.sort((a, b) => u(b) - u(a) || a.dueAt - b.dueAt);
  const urgency = (k: string) => (SYNTHETIC_FACETS.has(k) ? Infinity : groups.get(k)![0].dueAt);
  const order = [...groups.keys()].sort((a, b) => urgency(a) - urgency(b));
  const out: T[] = [];
  for (let i = 0; out.length < rows.length; i++) {
    for (const k of order) {
      const g = groups.get(k)!;
      if (i < g.length) out.push(g[i]);
    }
  }
  return out;
}

// Per-drill 0–1 performance scores (stage 3 of the exercise-system
// rebalance). Mapped to an FSRS rating at the boundary via
// fsrs.scoreToRating; the raw score is also logged for future tuning.

// Family sweep: hits over (members + wrong taps) — recalling 5/6 with
// no decoys tapped is ~0.83 (Hard), not a full lapse.
export function familySweepScore(members: string[], selected: Iterable<string>): number {
  const memberSet = new Set(members);
  let hits = 0;
  let wrong = 0;
  for (const c of selected) {
    if (memberSet.has(c)) hits++;
    else wrong++;
  }
  const denom = memberSet.size + wrong;
  return denom > 0 ? hits / denom : 0;
}

// Production: mistakes cost proportionally to character length, so a
// couple of misses on a long character costs less than on 三. Null
// strokeCount (stroke data unavailable) falls back to the old
// distinct-mistake thresholds expressed as scores.
export function productionScore(strokeCount: number | null, wrongStrokes: number): number {
  if (strokeCount && strokeCount > 0) {
    return Math.max(0, 1 - wrongStrokes / strokeCount);
  }
  if (wrongStrokes === 0) return 1;
  return wrongStrokes <= 2 ? 0.8 : 0;
}

export interface ClusterMemberResult {
  word: string;
  missed: boolean;
}

export interface ClusterGradePlan {
  grades: {
    word: string;
    facet: "meaningRecognition" | "soundRecognition";
    rating: "Good" | "Again";
  }[];
  // Chars/components to receive ONE damped cascade credit each —
  // union across all correctly-recalled members, so a component
  // shared by two members isn't credited twice for one card.
  cascadeTargets: string[];
}

// Cluster recall grading (stage 1): each member is graded from what
// the user actually reported (missed → Again, recalled → Good), and
// only rows that are due now are touched — non-due rows weren't part
// of today's workout.
export function planClusterGrades(
  results: ClusterMemberResult[],
  isRowDue: (word: string, facet: "meaningRecognition" | "soundRecognition") => boolean,
  closureOf: (word: string) => Iterable<string>,
): ClusterGradePlan {
  const grades: ClusterGradePlan["grades"] = [];
  const members = new Set(results.map((r) => r.word));
  const targets = new Set<string>();
  for (const r of results) {
    const rating = r.missed ? ("Again" as const) : ("Good" as const);
    for (const facet of ["meaningRecognition", "soundRecognition"] as const) {
      if (!isRowDue(r.word, facet)) continue;
      grades.push({ word: r.word, facet, rating });
      if (facet === "meaningRecognition" && rating === "Good") {
        for (const child of closureOf(r.word)) {
          if (!members.has(child)) targets.add(child);
        }
      }
    }
  }
  return { grades, cascadeTargets: [...targets] };
}

// Order the new-words pool so fresh×old combinations lead (v138,
// owner: "it is super fun to combine a newly learned character with
// an old one — my favorite game"): words containing at least one
// recently-learned character first, then common-words-first.
export function orderInferencePool<T extends { word: string; rank?: number | null }>(
  words: T[],
  recentChars: Set<string>,
): T[] {
  const recency = (w: T) => ([...w.word].some((c) => recentChars.has(c)) ? 0 : 1);
  return words.slice().sort((a, b) => recency(a) - recency(b) || (a.rank ?? 1e9) - (b.rank ?? 1e9));
}

export interface WordBuildTask {
  // The word's glyphs in answer order (duplicates kept — 妈妈 needs 妈
  // twice in the tray).
  chars: string[];
  tray: string[];
}

// Build-the-word game (v137): translation shown, assemble the hanzi
// from a tray of the word's characters plus decoys from the user's
// known characters. Null when there aren't enough decoys to make it a
// puzzle.
export function buildWordTray(
  word: string,
  savedWords: string[],
  rand: Rand = Math.random,
  decoyCount = 4,
): WordBuildTask | null {
  const glyphs = [...word];
  if (glyphs.length < 2) return null;
  const inWord = new Set(glyphs);
  const decoys = shuffle(
    knownChars(savedWords, 100).filter((c) => !inWord.has(c)),
    rand,
  ).slice(0, decoyCount);
  if (decoys.length < 2) return null;
  return { chars: glyphs, tray: shuffle([...glyphs, ...decoys], rand) };
}

export interface FamilySweepTask {
  component: string;
  members: string[];
  grid: string[];
}

interface FamilyEntry {
  char: string;
  family: string[];
}

// Family sweep: all usable family members of a component (must exist
// in data-chars so they render meaningfully) mixed with decoys drawn
// from other components' families. Needs ≥3 members to be worth a
// card.
export function buildFamilySweep(
  component: FamilyEntry,
  allComponents: FamilyEntry[],
  charExists: (char: string) => boolean,
  rand: Rand = Math.random,
): FamilySweepTask | null {
  const members = component.family
    .filter((f) => f && f !== component.char && charExists(f))
    .slice(0, 6);
  if (members.length < 3) return null;
  const memberSet = new Set(members);
  const decoyPool: string[] = [];
  for (const other of allComponents) {
    if (other.char === component.char) continue;
    for (const f of other.family) {
      if (!f || f === component.char || memberSet.has(f) || !charExists(f)) continue;
      decoyPool.push(f);
    }
  }
  const decoys = shuffle([...new Set(decoyPool)], rand).slice(0, Math.min(4, members.length));
  if (decoys.length < 2) return null;
  return {
    component: component.char,
    members,
    grid: shuffle([...members, ...decoys], rand),
  };
}
