// 词语接龙 — word chain (v117, owner-picked game): the next word must
// begin with the previous word's last character (学生 → 生日 → 日子).
// Pure play — no FSRS writes. Score = chain length.
//
// v156 (owner): the next word only has to CONTAIN the link character,
// anywhere (学生 → 先生 → 生日 all valid after 学生). The link joins
// the tray as a tile and the player builds the whole word.
//
// v121 (owner: "give a bunch of characters from which I can build the
// next word"): you are NOT shown candidate words or meanings — you
// get a tray of loose characters and must produce the continuation
// yourself. The tray carries the characters of a few valid
// continuations plus decoys that appear in no word containing the link.

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
    if (pool.some((x) => x !== w && x.includes(lastChar(w)))) return w;
  }
  return null;
}

export interface ChainStep {
  // The character the next word must contain.
  link: string;
  // Every unused pool word containing `link` — all are accepted.
  answers: string[];
  // Loose characters to build with: every character of up to
  // TRAY_ANSWERS answers (link included), padded with decoys.
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
  const answers = pool.filter((w) => !used.has(w) && w.includes(link));
  if (answers.length === 0) return null;

  // Multiset: a tile is consumed when tapped, so 谢谢 needs two 谢.
  const counts = new Map<string, number>();
  for (const a of shuffle(answers, rand).slice(0, TRAY_ANSWERS)) {
    const own = new Map<string, number>();
    for (const c of a) own.set(c, (own.get(c) ?? 0) + 1);
    for (const [c, n] of own) counts.set(c, Math.max(counts.get(c) ?? 0, n));
  }
  const needed = [...counts].flatMap(([c, n]) => Array<string>(n).fill(c));
  // A decoy must not appear in ANY pool word containing the link (used
  // or not) — being punished for tapping toward a word you know, or one
  // you already played, would feel unfair.
  const linked = pool.filter((w) => w.includes(link));
  const decoys = shuffle(
    [...new Set(pool.flatMap((w) => [...w]))].filter((c) => !linked.some((w) => w.includes(c))),
    rand,
  ).slice(0, Math.max(0, CHAIN_TRAY_SIZE - needed.length));
  if (decoys.length === 0) return null;

  return { link, answers, tray: shuffle([...needed, ...decoys], rand) };
}

// How a partially built continuation is doing. `built` is every
// character the player has tapped so far, link included.
export function chainBuildState(built: string, answers: string[]): "win" | "building" | "dead" {
  if (answers.includes(built)) return "win";
  if (answers.some((a) => a.startsWith(built))) return "building";
  return "dead";
}
