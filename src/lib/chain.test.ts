import { describe, expect, it } from "vitest";
import { chainBuildState, chainPool, nextChainStep, pickChainStart } from "./chain";

const pool = ["学生", "生日", "日子", "中国", "电话", "朋友", "生活"];

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
  it("lists every unused continuation and trays their completions", () => {
    const step = nextChainStep("学生", pool, new Set(["学生"]), () => 0);
    expect(step).not.toBeNull();
    expect(step!.link).toBe("生");
    expect(new Set(step!.answers)).toEqual(new Set(["生日", "生活"]));
    expect(step!.tray).toContain("日");
    expect(step!.tray).toContain("活");
  });
  it("decoys never complete a word of the pool", () => {
    const step = nextChainStep("学生", pool, new Set(["学生"]), () => 0)!;
    for (const c of step.tray) {
      const completes = pool.some((w) => w.startsWith("生" + c));
      const isNeeded = ["日", "活"].includes(c);
      expect(completes).toBe(isNeeded);
    }
  });
  it("dead end when no continuation is left", () => {
    expect(nextChainStep("学生", pool, new Set(["学生", "生日", "生活"]), () => 0)).toBeNull();
  });
});

describe("chainBuildState", () => {
  const answers = ["生日", "生活费"];
  it("recognizes a finished word", () => {
    expect(chainBuildState("生", "日", answers)).toBe("win");
  });
  it("keeps building through a longer word", () => {
    expect(chainBuildState("生", "活", answers)).toBe("building");
    expect(chainBuildState("生", "活费", answers)).toBe("win");
  });
  it("dead when the prefix leads nowhere", () => {
    expect(chainBuildState("生", "国", answers)).toBe("dead");
  });
});
