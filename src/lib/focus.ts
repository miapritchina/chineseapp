// Focus mode (v127): find "problem words" — high exposure, persistent
// failure, still not sticking — and build the massed-then-spaced
// practice queue for a Focus session. Pure so the rules are
// unit-testable.

export interface FocusRow {
  reps: number;
  lapses: number;
  stability: number;
}

// A word qualifies when, across its word-kind FSRS rows:
//   1. it has been seen plenty (total reps ≥ MIN_REPS — "should have
//      learned it by now"),
//   2. it still fails (total lapses ≥ MIN_LAPSES, or a lapse rate
//      ≥ LAPSE_RATE — "still error all the time"),
//   3. it never sticks (min stability < MAX_STABILITY_DAYS — filters
//      words that lapsed a lot long ago but are fine now).
export const FOCUS_MIN_REPS = 8;
export const FOCUS_MIN_LAPSES = 4;
export const FOCUS_LAPSE_RATE = 0.3;
export const FOCUS_MAX_STABILITY_DAYS = 7;
// Session size: few words, deep treatment.
export const FOCUS_POOL = 5;

export function isProblemWord(rows: FocusRow[]): boolean {
  if (rows.length === 0) return false;
  const reps = rows.reduce((n, r) => n + r.reps, 0);
  const lapses = rows.reduce((n, r) => n + r.lapses, 0);
  const minStability = Math.min(...rows.map((r) => r.stability));
  if (reps < FOCUS_MIN_REPS) return false;
  if (minStability >= FOCUS_MAX_STABILITY_DAYS) return false;
  return lapses >= FOCUS_MIN_LAPSES || lapses / reps >= FOCUS_LAPSE_RATE;
}

// Ranked worst-first: lapse rate, then raw lapses.
export function problemWords(savedWords: string[], rowsOf: (word: string) => FocusRow[]): string[] {
  const scored: { word: string; rate: number; lapses: number }[] = [];
  for (const w of savedWords) {
    const rows = rowsOf(w);
    if (!isProblemWord(rows)) continue;
    const reps = rows.reduce((n, r) => n + r.reps, 0);
    const lapses = rows.reduce((n, r) => n + r.lapses, 0);
    scored.push({ word: w, rate: reps > 0 ? lapses / reps : 0, lapses });
  }
  scored.sort((a, b) => b.rate - a.rate || b.lapses - a.lapses);
  return scored.map((s) => s.word);
}

export type FocusStepKind = "lesson" | "practice" | "test";

export interface FocusStep {
  word: string;
  kind: FocusStepKind;
}

// Massed-then-spaced: every word's lesson first, then a practice round
// (no FSRS write), then the graded test round — so each word's
// re-tests are separated by the other words. Deliberate exception to
// ADR-0014's no-same-day-retry: same-session repetition is the
// standard leech treatment (see ADR-0015).
export function buildFocusQueue(words: string[]): FocusStep[] {
  const out: FocusStep[] = [];
  for (const kind of ["lesson", "practice", "test"] as FocusStepKind[]) {
    for (const w of words) out.push({ word: w, kind });
  }
  return out;
}
