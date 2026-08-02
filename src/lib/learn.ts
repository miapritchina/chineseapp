// Learn-mode material (v110): saved words the review system hasn't
// properly met yet. Never-reviewed words first (newest saves first —
// they're the reason the owner opened Learn), then everything else
// weakest-first by recognition stability. Pure so the ordering rule
// is unit-testable.

export function learnPool(
  savedList: { word: string; savedAt: number }[],
  // null = never reviewed; otherwise the meaning-row stability.
  stabilityOf: (word: string) => number | null,
): string[] {
  const fresh: { word: string; savedAt: number }[] = [];
  const rest: { word: string; s: number }[] = [];
  for (const e of savedList) {
    const s = stabilityOf(e.word);
    if (s === null) fresh.push(e);
    else rest.push({ word: e.word, s });
  }
  fresh.sort((a, b) => b.savedAt - a.savedAt);
  rest.sort((a, b) => a.s - b.s);
  return [...fresh.map((e) => e.word), ...rest.map((r) => r.word)];
}
