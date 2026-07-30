import { describe, expect, it } from "vitest";
import { chainPool, nextChainStep, pickChainStart } from "./chain";

const pool = ["学生", "生日", "日子", "中国", "电话", "朋友"];

describe("chainPool", () => {
  it("multi-char words only, deduped", () => {
    expect(chainPool(["学生", "好", "学生", "中国"])).toEqual(["学生", "中国"]);
  });
});

describe("pickChainStart", () => {
  it("picks a word with a continuation", () => {
    const start = pickChainStart(pool, () => 0);
    expect(start).not.toBeNull();
    expect(pool.some((w) => w !== start && w.startsWith([...start!].pop()!))).toBe(true);
  });
  it("null when nothing chains", () => {
    expect(pickChainStart(["中国", "电话"], () => 0)).toBeNull();
  });
});

describe("nextChainStep", () => {
  it("exactly one option continues the chain", () => {
    const step = nextChainStep("学生", pool, new Set(["学生"]), () => 0);
    expect(step).not.toBeNull();
    expect(step!.link).toBe("生");
    expect(step!.options.filter((w) => w.startsWith("生"))).toEqual(["生日"]);
    expect(step!.options.length).toBeGreaterThanOrEqual(2);
  });
  it("dead end when no continuation is left", () => {
    expect(nextChainStep("学生", pool, new Set(["学生", "生日"]), () => 0)).toBeNull();
  });
  it("used words never reappear", () => {
    const step = nextChainStep("生日", pool, new Set(["学生", "生日"]), () => 0);
    expect(step!.options).not.toContain("学生");
    expect(step!.options.filter((w) => w.startsWith("日"))).toEqual(["日子"]);
  });
});
