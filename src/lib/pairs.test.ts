import { describe, expect, it } from "vitest";
import { buildPairsBoard, tilesMatch } from "./pairs";

const gloss = (w: string) => (w === "无" ? "" : `meaning of ${w}`);

describe("buildPairsBoard", () => {
  it("builds nPairs hanzi+gloss tiles from usable words", () => {
    const board = buildPairsBoard(["一", "二", "三", "四", "五", "六", "无"], gloss, () => 0, 6);
    expect(board).not.toBeNull();
    expect(board!.length).toBe(12);
    expect(board!.filter((t) => t.kind === "hanzi").length).toBe(6);
    expect(board!.some((t) => t.word === "无")).toBe(false);
  });
  it("null when there is not enough material", () => {
    expect(buildPairsBoard(["一", "二"], gloss, () => 0, 6)).toBeNull();
  });
});

describe("tilesMatch", () => {
  it("matches the two halves of one word only", () => {
    const [h, g] = [
      { id: 0, word: "你", kind: "hanzi" as const, text: "你" },
      { id: 1, word: "你", kind: "gloss" as const, text: "you" },
    ];
    expect(tilesMatch(h, g)).toBe(true);
    expect(tilesMatch(h, { ...h, id: 2 })).toBe(false);
    expect(tilesMatch(h, { ...g, word: "好" })).toBe(false);
  });
});
