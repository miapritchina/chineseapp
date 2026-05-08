// Hand-curated list of visually-confusable Chinese character clusters.
// When a card hits the leech threshold (default ts-fsrs lapses ≥ 6), the
// review page checks whether the failing item is in a cluster here and,
// if so, paints a side-by-side disambiguation view before letting the
// user grade again.
//
// Source: a synthesis of classic L2 Chinese pedagogy (Outlier, Skritter
// "easily confused" lists, common HSK 1–4 mistakes). Not exhaustive — add
// to it as real-world leeches surface in personal use.

export const CONFUSION_CLUSTERS = [
  ["易", "昜"],
  ["未", "末"],
  ["己", "已", "巳"],
  ["理", "埋"],
  ["戊", "戌", "戍", "戎"],
  ["土", "士"],
  ["千", "干", "于"],
  ["人", "入", "八"],
  ["午", "牛"],
  ["天", "夫"],
  ["王", "玉", "主"],
  ["大", "太", "犬", "尤"],
  ["白", "百", "自"],
  ["日", "目", "且"],
  ["毛", "手"],
  ["四", "西", "酉"],
  ["休", "体"],
  ["看", "着"],
  ["买", "卖"],
  ["问", "间", "闷"],
  ["几", "凡"],
  ["女", "毋"],
  ["田", "由", "甲", "申"],
  ["木", "本"],
  ["开", "井"],
];

// Default leech threshold. ts-fsrs default is 8 in some clients; Anki's
// is 8; the rollout brief calls for "≥ 6 lapses". We pick 6 to surface
// the disambig view earlier than the SRS engine itself would mark a leech.
export const LEECH_LAPSES = 6;

/**
 * Return the cluster containing `char`, or null if it isn't in any.
 * Lookup is O(N·M) over the curated list — small enough that we don't
 * need an index.
 * @param {string} char
 * @returns {string[] | null}
 */
export function clusterFor(char) {
  if (!char || char.length !== 1) return null;
  for (const cluster of CONFUSION_CLUSTERS) {
    if (cluster.includes(char)) return cluster;
  }
  return null;
}

/**
 * Strip down to the cluster's chars excluding the input one — what the
 * disambiguation card shows alongside the failing item.
 * @param {string} char
 * @returns {string[]}
 */
export function neighbors(char) {
  const c = clusterFor(char);
  return c ? c.filter((x) => x !== char) : [];
}
