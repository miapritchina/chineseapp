// Sift-mode helpers (v113): Tinder-style triage over the due backlog.
// Pure so the pool rule is unit-testable.

// Local YYYY-MM-DD — the left-swipe list resets at local midnight.
export function siftDayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Words worth sifting: something of theirs is due today and they
// haven't been left-swiped today. STRONGEST first — the whole point
// is clearing the well-known words fast, so the likely yeses lead.
export function siftPool(
  savedWords: string[],
  dueKeys: Set<string>,
  strengthOf: (w: string) => number,
  keptToday: Set<string>,
): string[] {
  return savedWords
    .filter((w) => dueKeys.has(w) && !keptToday.has(w))
    .sort((a, b) => strengthOf(b) - strengthOf(a));
}
