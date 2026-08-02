import { describe, expect, it } from "vitest";
import { anySmushLeft, buildWordForgeRound, forgeWordPool, smush } from "./forge";

const pool = ["学生", "生日", "日子", "学习", "中国"];
const wordSet = new Set(pool);

describe("forgeWordPool", () => {
  it("2-char words only, deduped", () => {
    expect(forgeWordPool(["学生", "好", "三字经", "学生", "中国"])).toEqual(["学生", "中国"]);
  });
});

describe("buildWordForgeRound", () => {
  it("tray holds every chosen word's characters", () => {
    const round = buildWordForgeRound(pool, () => 0, 4);
    expect(round).not.toBeNull();
    expect(round!.tiles.length).toBe(8);
    expect(round!.wordSet.has("中国")).toBe(true);
  });
  it("null under 4 pool words", () => {
    expect(buildWordForgeRound(["学生", "生日"], () => 0)).toBeNull();
  });
});

describe("smush", () => {
  it("tapped order wins, reversed order still counts", () => {
    expect(smush("学", "生", wordSet)).toBe("学生");
    expect(smush("生", "学", wordSet)).toBe("学生");
    expect(smush("日", "生", wordSet)).toBe("生日");
    expect(smush("中", "日", wordSet)).toBeNull();
  });
});

describe("anySmushLeft", () => {
  it("detects remaining combinations across orders", () => {
    expect(anySmushLeft(["日", "生"], wordSet)).toBe(true);
    expect(anySmushLeft(["中", "日", "习"], wordSet)).toBe(false);
    expect(anySmushLeft([], wordSet)).toBe(false);
  });
});
