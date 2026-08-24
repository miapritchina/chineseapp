// Flashcards / Browse deck (v143, owner request): a low-pressure flip
// deck for looking at saved words without the graded-workout pressure.
// The owner's complaint about plain flashcards was that they surfaced
// well-known words and got boring — so the order is spaced-repetition
// driven: everything due now (weakest first), then the weakest not-yet-
// due words as filler, and the well-mastered ones are dropped entirely.
// Pure so the ordering is unit-testable.

// A not-due word this strong (min recognition stability, in days) is
// well-enough known that browsing it is the "boring" case — kept out of
// the filler tail.
export const FLASHCARD_MASTERED_STABILITY_DAYS = 21;
// Cap on the filler tail so an empty due queue doesn't turn the deck
// into the entire vocabulary. Due cards are never capped.
export const FLASHCARD_FILLER_CAP = 30;

export function flashcardDeck(
  savedWords: string[],
  isDue: (word: string) => boolean,
  // Min recognition stability in days; higher = better known.
  weaknessOf: (word: string) => number,
): string[] {
  const due: string[] = [];
  const filler: string[] = [];
  for (const w of savedWords) {
    if (isDue(w)) due.push(w);
    else if (weaknessOf(w) < FLASHCARD_MASTERED_STABILITY_DAYS) filler.push(w);
  }
  const weakestFirst = (a: string, b: string) => weaknessOf(a) - weaknessOf(b);
  due.sort(weakestFirst);
  filler.sort(weakestFirst);
  return [...due, ...filler.slice(0, FLASHCARD_FILLER_CAP)];
}
