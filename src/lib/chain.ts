// 词语接龙 — word chain (v117, owner-picked game): the next word must
// begin with the previous word's last character (学生 → 生日 → 日子).
// Pure play — no FSRS writes. Score = chain length.

import { shuffle, type Rand } from "./drillGen";

export const CHAIN_OPTIONS = 4;

const lastChar = (w: string) => [...w][[...w].length - 1];

// Chain material: the user's multi-character saved words.
export function chainPool(savedWords: string[]): string[] {
  return [...new Set(savedWords.filter((w) => [...w].length >= 2))];
}

// A start word that has at least one continuation in the pool.
export function pickChainStart(pool: string[], rand: Rand = Math.random): string | null {
  for (const w of shuffle(pool, rand)) {
    if (pool.some((x) => x !== w && x.startsWith(lastChar(w)))) return w;
  }
  return null;
}

export interface ChainStep {
  // The character the next word must start with.
  link: string;
  // Exactly one option starts with `link` (correctness check is
  // startsWith, so the invariant is what makes the round fair).
  options: string[];
}

// Next step of the chain, or null when the pool has no continuation —
// a dead end, which ends the run as a WIN (the chain is exhausted).
export function nextChainStep(
  current: string,
  pool: string[],
  used: Set<string>,
  rand: Rand = Math.random,
): ChainStep | null {
  const link = lastChar(current);
  const valid = pool.filter((w) => !used.has(w) && w.startsWith(link));
  if (valid.length === 0) return null;
  const answer = valid[Math.floor(rand() * valid.length)];
  const distractors = shuffle(
    pool.filter((w) => !used.has(w) && !w.startsWith(link)),
    rand,
  ).slice(0, CHAIN_OPTIONS - 1);
  if (distractors.length === 0) return null;
  return { link, options: shuffle([answer, ...distractors], rand) };
}
