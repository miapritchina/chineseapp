// Character forge (v116, owner-picked game): loose components are
// scattered; tapping a valid pair "forges" a character the user
// knows (讠 + 青 = 请). Pure play — no FSRS writes.

import type { Char } from "./types";
import { shuffle, type Rand } from "./drillGen";

export interface ForgeTarget {
  char: string;
  pieces: [string, string];
}

export interface ForgeRound {
  targets: ForgeTarget[];
  // The scattered tray: every target's pieces, shuffled. All piece
  // glyphs are unique across the round, so each valid pair forges
  // exactly one target.
  pieces: string[];
}

// Material: every character inside the user's saved words that
// decomposes into exactly two distinct component glyphs.
export function forgeCandidates(
  savedWords: string[],
  chars: Record<string, Char> | null | undefined,
): ForgeTarget[] {
  if (!chars) return [];
  const seen = new Set<string>();
  const out: ForgeTarget[] = [];
  for (const w of savedWords) {
    for (const c of w) {
      if (seen.has(c)) continue;
      seen.add(c);
      const pieces = (chars[c]?.components ?? []).filter((p) => p.char && p.char !== "◎");
      if (pieces.length !== 2) continue;
      if (pieces[0].char === pieces[1].char) continue;
      out.push({ char: c, pieces: [pieces[0].char, pieces[1].char] });
    }
  }
  return out;
}

export function buildForgeRound(
  candidates: ForgeTarget[],
  rand: Rand = Math.random,
  targetCount = 5,
): ForgeRound | null {
  const used = new Set<string>();
  const targets: ForgeTarget[] = [];
  for (const t of shuffle(candidates, rand)) {
    if (targets.length >= targetCount) break;
    // Unique pieces only — and a piece may not double as another
    // target's result, or one tap could mean two different things.
    if (used.has(t.pieces[0]) || used.has(t.pieces[1]) || used.has(t.char)) continue;
    if (targets.some((x) => x.char === t.pieces[0] || x.char === t.pieces[1])) continue;
    used.add(t.pieces[0]);
    used.add(t.pieces[1]);
    used.add(t.char);
    targets.push(t);
  }
  if (targets.length < 3) return null;
  return {
    targets,
    pieces: shuffle(
      targets.flatMap((t) => t.pieces),
      rand,
    ),
  };
}

// Which unforged target (if any) do these two tray pieces make?
export function forgeMatch(
  targets: ForgeTarget[],
  forged: Set<string>,
  a: string,
  b: string,
): ForgeTarget | null {
  for (const t of targets) {
    if (forged.has(t.char)) continue;
    if ((t.pieces[0] === a && t.pieces[1] === b) || (t.pieces[0] === b && t.pieces[1] === a)) {
      return t;
    }
  }
  return null;
}
