import { describe, expect, it } from "vitest";
import {
  buildFamilySweep,
  inferencePairs,
  knownChars,
  pickClozeTask,
  pickGlossOptions,
  pickReverseOptions,
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
