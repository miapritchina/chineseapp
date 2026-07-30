// Pairs board (v116, owner-picked game): classic memory match, hanzi
// tiles against meaning tiles from the user's due words. Pure play —
// no FSRS writes.

import { shuffle, type Rand } from "./drillGen";

export interface PairTile {
  id: number;
  word: string;
  kind: "hanzi" | "gloss";
  text: string;
}

export const PAIRS_PER_BOARD = 6;

export function buildPairsBoard(
  words: string[],
  glossOf: (word: string) => string,
  rand: Rand = Math.random,
  nPairs = PAIRS_PER_BOARD,
): PairTile[] | null {
  const usable = words.filter((w) => glossOf(w));
  if (usable.length < nPairs) return null;
  const chosen = shuffle(usable, rand).slice(0, nPairs);
  const tiles = chosen.flatMap((w, i): PairTile[] => [
    { id: i * 2, word: w, kind: "hanzi", text: w },
    { id: i * 2 + 1, word: w, kind: "gloss", text: glossOf(w) },
  ]);
  return shuffle(tiles, rand);
}

// Two face-up tiles match when they are the two halves of one word.
export function tilesMatch(a: PairTile, b: PairTile): boolean {
  return a.word === b.word && a.kind !== b.kind;
}
