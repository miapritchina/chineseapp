// Pure helpers for the Explore page (docs/product/explore-page.md).
// No React, no IO — index building and badge math take data in and
// return data out so the rules are unit-testable.

import type { Char } from "./types";

// Reverse component index: component char → every character built
// with it, per data-chars decompositions. Built once and memoized by
// the caller (~10k rows, linear).
export function buildComponentIndex(chars: Record<string, Char>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [c, data] of Object.entries(chars)) {
    for (const piece of data.components ?? []) {
      if (!piece.char || piece.char === c) continue;
      const arr = out.get(piece.char);
      if (arr) {
        if (!arr.includes(c)) arr.push(c);
      } else {
        out.set(piece.char, [c]);
      }
    }
  }
  return out;
}

// char → saved words containing it (a word maps from each of its
// distinct characters).
export function charToSavedWords(savedWords: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const w of savedWords) {
    for (const c of new Set(w)) {
      const arr = out.get(c);
      if (arr) arr.push(w);
      else out.set(c, [w]);
    }
  }
  return out;
}

// My saved words connected to a char/component: words containing it
// directly, plus words containing any character BUILT WITH it (请假
// connects to 青 through 请). Direct hits first, insertion order
// otherwise.
export function wordsUsing(
  key: string,
  charWords: Map<string, string[]>,
  componentIndex?: Map<string, string[]>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of charWords.get(key) ?? []) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  for (const built of componentIndex?.get(key) ?? []) {
    for (const w of charWords.get(built) ?? []) {
      if (!seen.has(w)) {
        seen.add(w);
        out.push(w);
      }
    }
  }
  return out;
}

// Connection badge (owner decision: SAVED SET ONLY — "is this
// direction worth walking for my words?").
//   char/component → my saved words using it, directly or through a
//                    character built with it
//   word           → how many of my OTHER saved words share a character
export function savedConnections(
  key: string,
  kind: "word" | "char" | "component",
  charWords: Map<string, string[]>,
  componentIndex?: Map<string, string[]>,
): number {
  if (kind === "word") {
    const others = new Set<string>();
    for (const c of new Set(key)) {
      for (const w of charWords.get(c) ?? []) {
        if (w !== key) others.add(w);
      }
    }
    return others.size;
  }
  return wordsUsing(key, charWords, componentIndex).length;
}

// My saved words that share at least one character with `word`
// (excluding the word itself), most recently saved first per the
// caller's savedWords order.
export function wordsSharingChar(word: string, savedWords: string[]): string[] {
  const chars = new Set(word);
  const out: string[] = [];
  for (const w of savedWords) {
    if (w === word) continue;
    if ([...w].some((c) => chars.has(c))) out.push(w);
  }
  return out;
}
