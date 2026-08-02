import { describe, expect, it } from "vitest";
import { crossRefTarget, crossRefTargets, resolveCrossRefs } from "./gloss";
import type { Word } from "./types";

const yikuai = {
  word: "一块",
  definitions: ["lump; piece", "together"],
} as Word;
const lookup = (w: string) => (w === "一块" ? yikuai : null);

describe("crossRefTarget", () => {
  it("extracts the simplified target from trad|simp[pinyin]", () => {
    expect(crossRefTarget("erhua variant of 一塊|一块[yī​kuài]")).toBe("一块");
    expect(crossRefTarget("variant of 周[zhōu]")).toBe("周");
    expect(crossRefTarget("old variant of 说")).toBe("说");
  });
  it("leaves real definitions alone", () => {
    expect(crossRefTarget("lump; piece")).toBeNull();
    expect(crossRefTarget("a variant of the usual approach")).toBeNull();
  });
});

describe("resolveCrossRefs", () => {
  it("pulls the target's meaning in", () => {
    expect(resolveCrossRefs(["erhua variant of 一塊|一块[yī​kuài]"], lookup)).toEqual([
      "casual 儿-form of 一块: lump; piece; together",
    ]);
  });
  it("falls back to a cleaned reference when the target is not cached", () => {
    expect(resolveCrossRefs(["variant of 沒有|没有[méi yǒu]"], () => null)).toEqual([
      "variant of 没有",
    ]);
  });
  it("crossRefTargets lists only referenced words", () => {
    expect(crossRefTargets(["lump", "erhua variant of 一塊|一块[yī kuài]"])).toEqual(["一块"]);
  });
});
