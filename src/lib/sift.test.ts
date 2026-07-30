import { describe, expect, it } from "vitest";
import { siftDayKey, siftPool } from "./sift";

describe("siftPool", () => {
  const strength = (w: string) => ({ 强: 30, 中: 5, 弱: 0.4 })[w] ?? 0;
  it("filters to due words minus today's left-swipes, strongest first", () => {
    expect(
      siftPool(["弱", "强", "中", "另"], new Set(["弱", "强", "中"]), strength, new Set(["中"])),
    ).toEqual(["强", "弱"]);
  });
  it("empty when nothing due", () => {
    expect(siftPool(["你"], new Set(), strength, new Set())).toEqual([]);
  });
});

describe("siftDayKey", () => {
  it("uses local date parts", () => {
    expect(siftDayKey(new Date(2026, 6, 20, 23, 59))).toBe("2026-07-20");
  });
});
