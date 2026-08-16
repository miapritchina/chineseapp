import { describe, expect, it } from "vitest";
import {
  buildFamilySweep,
  familySweepScore,
  inferencePairs,
  interleaveByActivity,
  knownChars,
  pickClozeTask,
  pickGlossOptions,
  pickReverseOptions,
  planClusterGrades,
  productionScore,
} from "./drillGen";

// Deterministic "random": always 0 → shuffles become identity,
// mask index → 0.
const rand0 = () => 0;

describe("knownChars", () => {
  it("dedupes across words preserving first-seen order", () => {
    expect(knownChars(["你好", "好人"])).toEqual(["你", "好", "人"]);
  });
  it("caps the result", () => {
    expect(knownChars(["一二三四五"], 3)).toEqual(["一", "二", "三"]);
  });
});

describe("inferencePairs", () => {
  it("produces ordered pairs excluding saved words and identity pairs", () => {
    const pairs = inferencePairs(["你好"]);
    expect(pairs).toContain("好你");
    expect(pairs).not.toContain("你好"); // already saved
    expect(pairs).not.toContain("你你");
  });
});

describe("pickReverseOptions", () => {
  it("prefers distractors sharing a char with the answer", () => {
    const opts = pickReverseOptions("你好", ["你好", "好人", "中国", "学习", "朋友"], 4, rand0);
    expect(opts).not.toBeNull();
    expect(opts).toContain("你好");
    expect(opts).toContain("好人"); // shares 好 → must beat unrelated words
    expect(opts!.length).toBe(4);
  });
  it("returns null with fewer than 2 total options", () => {
    expect(pickReverseOptions("你好", ["你好"], 4, rand0)).toBeNull();
  });
  it("prefers same-length distractors over different-length ones", () => {
    const opts = pickReverseOptions(
      "你好",
      ["你好", "中国", "朋友", "学习", "发展中国家", "三字经课本"],
      4,
      rand0,
    );
    // Three two-char candidates fill the distractor slots ahead of the
    // five-char ones.
    expect(opts).toEqual(expect.arrayContaining(["你好", "中国", "朋友", "学习"]));
  });
  it("prefers distractors sharing a component when char data is available", () => {
    // 清 and 情 share the 青 component; 木林 shares nothing with 清水.
    const componentsOf = (c: string) =>
      ({ 清: ["青", "氵"], 情: ["青", "忄"], 水: [], 木: [], 林: ["木"], 大: [], 人: [] })[c] ?? [];
    const opts = pickReverseOptions(
      "清水",
      ["清水", "情人", "木林", "大人"],
      3,
      rand0,
      componentsOf,
    );
    expect(opts).toContain("情人"); // component cousin must make the cut
  });
});

describe("pickClozeTask", () => {
  const clusterFor = (c: string) => (c === "你" ? ["尔", "妳"] : null);
  it("masks a char and offers the answer among cluster distractors", () => {
    const task = pickClozeTask("你好", ["你好", "中国"], clusterFor, rand0);
    expect(task).not.toBeNull();
    expect(task!.maskIndex).toBe(0);
    expect(task!.answer).toBe("你");
    expect(task!.options).toContain("你");
    expect(task!.options).toContain("尔"); // cluster member preferred
    // No option repeats a char that is visible in the word.
    expect(task!.options).not.toContain("好");
  });
  it("rejects single-char words", () => {
    expect(pickClozeTask("好", ["好"], clusterFor, rand0)).toBeNull();
  });
  it("pads from other saved words when there is no cluster", () => {
    const task = pickClozeTask("中国", ["中国", "你好", "学习"], () => null, rand0);
    expect(task).not.toBeNull();
    expect(task!.options.length).toBeGreaterThanOrEqual(2);
  });
});

describe("pickGlossOptions", () => {
  it("returns the correct gloss among shuffled distinct distractors", () => {
    const opts = pickGlossOptions("hello", ["friend", "China", "to study", "hello"], 4, rand0);
    expect(opts).not.toBeNull();
    expect(opts).toContain("hello");
    expect(new Set(opts).size).toBe(opts!.length);
    expect(opts!.length).toBe(4);
  });
  it("null when no distractor is available", () => {
    expect(pickGlossOptions("hello", ["hello", ""], 4, rand0)).toBeNull();
  });
});

describe("buildFamilySweep", () => {
  const comps = [
    { char: "青", family: ["请", "情", "晴", "清"] },
    { char: "尔", family: ["你", "您", "弥"] },
  ];
  const exists = () => true;
  it("mixes all members with decoys from other families", () => {
    const task = buildFamilySweep(comps[0], comps, exists, rand0);
    expect(task).not.toBeNull();
    expect(task!.members).toEqual(["请", "情", "晴", "清"]);
    for (const m of task!.members) expect(task!.grid).toContain(m);
    const decoys = task!.grid.filter((c) => !task!.members.includes(c));
    expect(decoys.length).toBeGreaterThanOrEqual(2);
    for (const d of decoys) expect(comps[1].family).toContain(d);
  });
  it("requires at least 3 usable members", () => {
    const small = { char: "青", family: ["请", "情"] };
    expect(buildFamilySweep(small, comps, exists, rand0)).toBeNull();
  });
  it("drops members missing from data-chars", () => {
    const task = buildFamilySweep(comps[0], comps, (c) => c !== "清", rand0);
    expect(task!.members).toEqual(["请", "情", "晴"]);
  });
});

describe("interleaveByActivity", () => {
  const row = (facet: string, dueAt: number, id: string) => ({ facet, dueAt, id });
  it("round-robins across groups, most overdue first within each", () => {
    const out = interleaveByActivity([
      row("meaningRecognition", 3, "r3"),
      row("meaningRecognition", 1, "r1"),
      row("production", 5, "p5"),
      row("production", 2, "p2"),
      row("clozeChar", 10, "c10"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1", "p2", "c10", "r3", "p5"]);
  });
  it("unifies meaning/sound/legacy recognition into one group", () => {
    const out = interleaveByActivity([
      row("soundRecognition", 2, "s2"),
      row("meaningRecognition", 1, "m1"),
      row("recognition", 3, "l3"),
      row("production", 4, "p4"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["m1", "p4", "s2", "l3"]);
  });
  it("rotates the synthetic facets last despite their dueAt of 0", () => {
    const out = interleaveByActivity([
      row("wordInference", 0, "w"),
      row("clusterRecall", 0, "c"),
      row("meaningRecognition", 7, "m"),
    ]);
    expect(out.map((r) => r.id)[0]).toBe("m");
  });
  it("keeps single-group input in most-overdue order", () => {
    const out = interleaveByActivity([
      row("meaningRecognition", 9, "b"),
      row("meaningRecognition", 4, "a"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("familySweepScore", () => {
  it("full sweep with no decoys is 1", () => {
    expect(familySweepScore(["请", "情", "清"], ["请", "情", "清"])).toBe(1);
  });
  it("a missed member earns partial credit, not zero", () => {
    expect(familySweepScore(["请", "情", "清"], ["请", "情"])).toBeCloseTo(2 / 3);
  });
  it("wrong taps grow the denominator", () => {
    expect(familySweepScore(["请", "情", "清"], ["请", "情", "清", "很"])).toBeCloseTo(3 / 4);
  });
  it("empty selection is 0", () => {
    expect(familySweepScore(["请", "情", "清"], [])).toBe(0);
  });
});

describe("productionScore", () => {
  it("is proportional to stroke count", () => {
    expect(productionScore(10, 0)).toBe(1);
    expect(productionScore(10, 2)).toBeCloseTo(0.8);
    expect(productionScore(3, 1)).toBeCloseTo(2 / 3);
  });
  it("never goes below 0", () => {
    expect(productionScore(2, 5)).toBe(0);
  });
  it("falls back to mistake thresholds without stroke data", () => {
    expect(productionScore(null, 0)).toBe(1);
    expect(productionScore(null, 2)).toBe(0.8);
    expect(productionScore(null, 3)).toBe(0);
  });
});

describe("planClusterGrades", () => {
  const closures = new Map<string, string[]>([
    ["请求", ["请", "求", "讠", "青"]],
    ["情况", ["情", "况", "忄", "青"]],
    ["清水", ["清", "水", "氵", "青"]],
  ]);
  const closureOf = (w: string) => closures.get(w) ?? [];

  it("grades missed members Again and the rest Good, both facets", () => {
    const plan = planClusterGrades(
      [
        { word: "请求", missed: false },
        { word: "情况", missed: true },
      ],
      () => true,
      closureOf,
    );
    expect(plan.grades).toContainEqual({
      word: "请求",
      facet: "meaningRecognition",
      rating: "Good",
    });
    expect(plan.grades).toContainEqual({ word: "请求", facet: "soundRecognition", rating: "Good" });
    expect(plan.grades).toContainEqual({
      word: "情况",
      facet: "meaningRecognition",
      rating: "Again",
    });
    expect(plan.grades).toHaveLength(4);
  });

  it("skips rows that are not due", () => {
    const plan = planClusterGrades(
      [{ word: "请求", missed: false }],
      (_w, facet) => facet === "meaningRecognition",
      closureOf,
    );
    expect(plan.grades).toEqual([{ word: "请求", facet: "meaningRecognition", rating: "Good" }]);
  });

  it("dedupes cascade targets shared across members and excludes missed members' closures", () => {
    const plan = planClusterGrades(
      [
        { word: "请求", missed: false },
        { word: "清水", missed: false },
        { word: "情况", missed: true },
      ],
      () => true,
      closureOf,
    );
    // 青 shared by both Good members appears once; 情况's closure absent.
    expect(plan.cascadeTargets.filter((t) => t === "青")).toHaveLength(1);
    expect(plan.cascadeTargets).not.toContain("忄");
    expect(plan.cascadeTargets).toContain("讠");
    expect(plan.cascadeTargets).toContain("氵");
  });

  it("no cascade when meaning row is not due", () => {
    const plan = planClusterGrades(
      [{ word: "请求", missed: false }],
      (_w, facet) => facet === "soundRecognition",
      closureOf,
    );
    expect(plan.cascadeTargets).toEqual([]);
  });
});
