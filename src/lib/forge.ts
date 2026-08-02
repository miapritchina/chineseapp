// Word forge (v118, replaced the component forge the owner didn't
// enjoy): Smush-style — a tray of loose characters from the user's
// saved two-character words; tap two to smush them into ANY saved
// word (either order counts, tapped order wins). Keep smushing until
// no remaining pair forms a word; an empty tray is a perfect clear.
// Pure play — no FSRS writes.

import { shuffle, type Rand } from "./drillGen";

export const FORGE_WORDS_PER_ROUND = 7;

export interface WordForgeRound {
  // The tray: every chosen word's characters, shuffled. Duplicates
  // are real tiles — 学生 + 生日 puts two 生 in the tray.
  tiles: string[];
  // Every saved 2-char word is a valid smush, not just the seeds —
  // cross-combinations are the fun (学+习 from 学生's 学).
  wordSet: Set<string>;
}

export function forgeWordPool(savedWords: string[]): string[] {
  return [...new Set(savedWords.filter((w) => [...w].length === 2))];
}

export function buildWordForgeRound(
  pool: string[],
  rand: Rand = Math.random,
  wordCount = FORGE_WORDS_PER_ROUND,
): WordForgeRound | null {
  if (pool.length < 4) return null;
  const chosen = shuffle(pool, rand).slice(0, wordCount);
  return {
    tiles: shuffle(
      chosen.flatMap((w) => [...w]),
      rand,
    ),
    wordSet: new Set(pool),
  };
}

// The word two tiles smush into, or null. Tapped order wins when both
// orders are words (蜂蜜 vs 蜜蜂).
export function smush(a: string, b: string, wordSet: Set<string>): string | null {
  if (wordSet.has(a + b)) return a + b;
  if (wordSet.has(b + a)) return b + a;
  return null;
}

// Round over when no remaining pair smushes into a word.
export function anySmushLeft(remaining: string[], wordSet: Set<string>): boolean {
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      if (smush(remaining[i], remaining[j], wordSet)) return true;
    }
  }
  return false;
}
