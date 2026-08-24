import { describe, expect, it } from "vitest";
import { flashcardDeck, FLASHCARD_FILLER_CAP } from "./flashcards";

describe("flashcardDeck", () => {
  const weakness = (w: string) => ({ 强: 30, 中: 5, 弱: 0.4, 新: 0 })[w] ?? 0;

  it("due first (weakest first), then not-due filler weakest first", () => {
    const saved = ["强", "中", "弱", "新"];
    const due = new Set(["弱", "新"]);
    expect(flashcardDeck(saved, (w) => due.has(w), weakness)).toEqual(["新", "弱", "中"]);
    // 强 is dropped: not due and above the mastered cutoff.
  });

  it("drops well-mastered not-due words from the filler tail", () => {
    expect(flashcardDeck(["强"], () => false, weakness)).toEqual([]);
  });

  it("keeps a mastered word when it is actually due", () => {
    expect(flashcardDeck(["强"], () => true, weakness)).toEqual(["强"]);
  });

  it("caps the filler tail but never the due queue", () => {
    // All weak (below the mastered cutoff) so only the cap trims filler.
    const many = Array.from({ length: 50 }, (_, i) => `w${i}`);
    const dueFirst10 = new Set(many.slice(0, 10));
    const out = flashcardDeck(
      many,
      (x) => dueFirst10.has(x),
      () => 0,
    );
    expect(out.length).toBe(10 + FLASHCARD_FILLER_CAP);
    expect(out.slice(0, 10)).toEqual(many.slice(0, 10));
  });

  it("empty in, empty out", () => {
    expect(flashcardDeck([], () => true, weakness)).toEqual([]);
  });
});
