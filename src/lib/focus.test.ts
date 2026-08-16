import { describe, expect, it } from "vitest";
import { buildFocusQueue, isProblemWord, problemWords } from "./focus";

const row = (reps: number, lapses: number, stability: number) => ({ reps, lapses, stability });

describe("isProblemWord", () => {
  it("needs exposure, failure, and weakness together", () => {
    expect(isProblemWord([row(10, 5, 2)])).toBe(true);
  });
  it("not enough reps → not a problem yet", () => {
    expect(isProblemWord([row(5, 5, 2)])).toBe(false);
  });
  it("stable now → recovered, not a problem", () => {
    expect(isProblemWord([row(20, 6, 30)])).toBe(false);
  });
  it("lapse RATE qualifies even below the absolute lapse floor", () => {
    expect(isProblemWord([row(9, 3, 2)])).toBe(true); // 33% > 30%
    expect(isProblemWord([row(20, 3, 2)])).toBe(false); // 15%
  });
  it("aggregates across rows", () => {
    expect(
      isProblemWord([row(5, 2, 10), row(5, 2, 1)]), // 10 reps, 4 lapses, min stab 1
    ).toBe(true);
  });
  it("no rows → false", () => {
    expect(isProblemWord([])).toBe(false);
  });
});

describe("problemWords", () => {
  it("ranks by lapse rate, worst first", () => {
    const stats = new Map([
      ["甲", [row(10, 4, 1)]], // 40%
      ["乙", [row(20, 12, 1)]], // 60%
      ["丙", [row(10, 1, 1)]], // fine
    ]);
    expect(problemWords(["甲", "乙", "丙"], (w) => stats.get(w) ?? [])).toEqual(["乙", "甲"]);
  });
});

describe("buildFocusQueue", () => {
  it("lessons, then practice round, then test round — words interleaved", () => {
    expect(buildFocusQueue(["甲", "乙"])).toEqual([
      { word: "甲", kind: "lesson" },
      { word: "乙", kind: "lesson" },
      { word: "甲", kind: "practice" },
      { word: "乙", kind: "practice" },
      { word: "甲", kind: "test" },
      { word: "乙", kind: "test" },
    ]);
  });
});
