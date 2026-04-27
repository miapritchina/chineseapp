import type { Word } from "./types";
import { HAN_RE, normalizePinyin } from "./pinyin";

export const MAX_RESULTS = 30;

// Tiered ranking: exact > hanzi-prefix > hanzi-substring > pinyin-prefix
// > pinyin-substring > English-substring. Within each tier, sort by
// movieWordRank ascending (NULLs last).
export function rankResults(words: Word[], query: string): Word[] {
  const q = query.trim();
  if (!q) return [];
  const isHan = HAN_RE.test(q);
  const np = normalizePinyin(q);
  const lq = q.toLowerCase();

  type Scored = { w: Word; tier: number; rank: number };
  const tiered: Scored[] = [];
  for (const w of words) {
    const sp = w.searchablePinyin || normalizePinyin(w.pinyin);
    let tier = -1;
    if (isHan) {
      if (w.simp === q) tier = 0;
      else if (w.simp.startsWith(q)) tier = 1;
      else if (w.simp.includes(q)) tier = 2;
    } else if (np && sp.startsWith(np)) tier = 1;
    else if (np && sp.includes(np)) tier = 3;
    else if ((w.definitions || []).some((d) => d.toLowerCase().includes(lq))) tier = 4;
    if (tier === -1) continue;
    tiered.push({ w, tier, rank: w.rank ?? 999999 });
  }
  tiered.sort((a, b) => a.tier - b.tier || a.rank - b.rank);
  return tiered.slice(0, MAX_RESULTS).map((x) => x.w);
}
