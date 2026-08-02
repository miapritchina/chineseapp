// 词语接龙 — word chain (v117, owner-picked game): the next word must
// begin with the previous word's last character (学生 → 生日 → 日子).
// Pure play — no FSRS writes. Score = chain length.
//
// v121 (owner: "give a bunch of characters from which I can build the
// next word"): you are NOT shown candidate words or meanings — you
// get a tray of loose characters and must produce the continuation
// yourself. Any of your unused words starting with the link counts,
// so the tray carries the completions of a few of them plus decoys
// that provably cannot start a word with the link.

import { shuffle, type Rand } from "./drillGen";

export const CHAIN_TRAY_SIZE = 9;
// How many valid continuations get their completion characters into
// the tray. More would make the step trivially easy.
const TRAY_ANSWERS = 3;

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
  // Every unused pool word starting with `link` — all are accepted.
  answers: string[];
  // Loose characters to build with: completions of up to TRAY_ANSWERS
  // answers, padded with decoys.
  tray: string[];
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
  const answers = pool.filter((w) => !used.has(w) && w.startsWith(link));
  if (answers.length === 0) return null;

  const needed: string[] = [];
  for (const a of shuffle(answers, rand).slice(0, TRAY_ANSWERS)) {
    for (const c of [...a].slice(1)) if (!needed.includes(c)) needed.push(c);
  }
  // A decoy must not complete ANY word of the pool (used or not) —
  // being punished for tapping a word you know, or one you already
  // played, would feel unfair.
  const decoys = shuffle(
    [...new Set(pool.flatMap((w) => [...w]))].filter(
      (c) => c !== link && !needed.includes(c) && !pool.some((w) => w.startsWith(link + c)),
    ),
    rand,
  ).slice(0, Math.max(0, CHAIN_TRAY_SIZE - needed.length));
  if (decoys.length === 0) return null;

  return { link, answers, tray: shuffle([...needed, ...decoys], rand) };
}

// How a partially built continuation is doing. `built` is what the
// player has tapped so far, excluding the link character.
export function chainBuildState(
  link: string,
  built: string,
  answers: string[],
): "win" | "building" | "dead" {
  const s = link + built;
  if (answers.includes(s)) return "win";
  if (answers.some((a) => a.startsWith(s))) return "building";
  return "dead";
}
