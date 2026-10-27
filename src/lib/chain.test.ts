import { describe, expect, it } from "vitest";
import { chainBuildState, chainPool, nextChainStep, pickChainStart } from "./chain";

const pool = ["学生", "生日", "日子", "中国", "电话", "朋友", "先生", "喝水"];

describe("chainPool", () => {
  it("multi-char words only, deduped", () => {
    expect(chainPool(["学生", "好", "学生", "中国"])).toEqual(["学生", "中国"]);
  });
});

describe("pickChainStart", () => {
  it("picks a word with a continuation", () => {
    const start = pickChainStart(pool, () => 0);
    expect(start).not.toBeNull();
    expect(pool.some((w) => w !== start && w.includes([...start!].pop()!))).toBe(true);
  });
  it("a continuation may contain the link anywhere", () => {
    expect(pickChainStart(["中国", "学生", "先生"], () => 0)).not.toBeNull();
  });
  it("null when nothing chains", () => {
    expect(pickChainStart(["中国", "电话"], () => 0)).toBeNull();
  });
});

describe("nextChainStep", () => {
  it("accepts every unused word containing the link, in any position", () => {
    const step = nextChainStep("学生", pool, new Set(["学生"]), () => 0);
    expect(step).not.toBeNull();
    expect(step!.link).toBe("生");
    expect(new Set(step!.answers)).toEqual(new Set(["生日", "先生"]));
  });
  it("trays every character of the answers, link included", () => {
    const step = nextChainStep("学生", pool, new Set(["学生"]), () => 0)!;
    for (const c of ["生", "日", "先"]) expect(step.tray).toContain(c);
  });
  it("trays a repeated character once per occurrence", () => {
    const p = ["学生", "生生", "中国", "电话", "朋友", "喝水"];
    const step = nextChainStep("学生", p, new Set(["学生"]), () => 0)!;
    expect(step.tray.filter((c) => c === "生")).toHaveLength(2);
  });
  it("decoys appear in no pool word containing the link", () => {
    const step = nextChainStep("学生", pool, new Set(["学生"]), () => 0)!;
    const linked = pool.filter((w) => w.includes("生"));
    const needed = new Set(["生", "日", "先"]);
    for (const c of step.tray) {
      if (needed.has(c)) continue;
      expect(linked.some((w) => w.includes(c))).toBe(false);
    }
  });
  it("links on the new character, not the one the word was built around", () => {
    const p = [...pool, "首先"];
    const next = nextChainStep("先生", p, new Set(["学生", "先生"]), () => 0, "生")!;
    expect(next.link).toBe("先");
    expect(next.answers).toEqual(["首先"]);
  });
  it("prefers the new character with the most continuations", () => {
    const p = ["中国人", "国家", "人们", "人口", "电话", "朋友", "喝水", "先生"];
    expect(nextChainStep("中国人", p, new Set(["中国人"]), () => 0, "中")!.link).toBe("人");
    const noRen = p.filter((w) => !w.startsWith("人"));
    expect(nextChainStep("中国人", noRen, new Set(["中国人"]), () => 0, "中")!.link).toBe("国");
  });
  it("falls back to the old link when no new character continues", () => {
    const step = nextChainStep("先生", pool, new Set(["学生", "先生"]), () => 0, "生")!;
    expect(step.link).toBe("生");
    expect(step.answers).toEqual(["生日"]);
  });
  it("a word of only the link character keeps that link", () => {
    const p = ["学生", "生生", "生日", "电话", "朋友", "喝水"];
    expect(nextChainStep("生生", p, new Set(["学生", "生生"]), () => 0, "生")!.link).toBe("生");
  });
  it("dead end when no continuation is left", () => {
    expect(nextChainStep("学生", pool, new Set(["学生", "生日", "先生"]), () => 0)).toBeNull();
  });
});

describe("chainBuildState", () => {
  const answers = ["生日", "先生", "生活费"];
  it("recognizes a finished word with the link first or last", () => {
    expect(chainBuildState("生日", answers)).toBe("win");
    expect(chainBuildState("先生", answers)).toBe("win");
  });
  it("keeps building through a longer word", () => {
    expect(chainBuildState("先", answers)).toBe("building");
    expect(chainBuildState("生活", answers)).toBe("building");
    expect(chainBuildState("生活费", answers)).toBe("win");
  });
  it("dead when the prefix leads nowhere", () => {
    expect(chainBuildState("国", answers)).toBe("dead");
    expect(chainBuildState("生国", answers)).toBe("dead");
  });
});
