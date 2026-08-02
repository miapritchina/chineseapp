import { describe, expect, it } from "vitest";
import { learnPool } from "./learn";

describe("learnPool", () => {
  const saved = [
    { word: "老", savedAt: 1 },
    { word: "新", savedAt: 9 },
    { word: "弱", savedAt: 5 },
    { word: "强", savedAt: 7 },
  ];
  const stab = (w: string) => ({ 老: 4, 弱: 0.5, 强: 20 })[w] ?? null;

  it("never-reviewed first (newest saved leading), then weakest-first", () => {
    expect(learnPool(saved, stab)).toEqual(["新", "弱", "老", "强"]);
  });
  it("all-new pool sorts by most recently saved", () => {
    expect(learnPool(saved, () => null)).toEqual(["新", "强", "弱", "老"]);
  });
  it("empty in, empty out", () => {
    expect(learnPool([], stab)).toEqual([]);
  });
});
