// Tests for the saved-words-by-component search.
// Run with: node scripts/test-component-search.mjs (or as part of `npm test`).

import {
  componentClosure,
  searchByComponent,
  componentFrequencies,
} from "../src/lib/componentSearch.mjs";
import assert from "node:assert/strict";

const fixtureChars = {
  "新": {
    components: [
      { char: "立", type: "iconic" },
      { char: "木", type: "iconic" },
      { char: "斤", type: "sound" },
    ],
  },
  "年": { components: [] },
  "学": { components: [{ char: "子", type: "meaning" }] },
  "习": { components: [] },
  "好": {
    components: [
      { char: "女", type: "meaning" },
      { char: "子", type: "meaning" },
    ],
  },
  "请": {
    components: [
      { char: "讠", type: "meaning" },
      { char: "青", type: "sound" },
    ],
  },
  "青": {
    components: [
      { char: "生", type: "iconic" },
      { char: "井", type: "iconic" },
    ],
  },
  // Self-referential garbage — guard against infinite loop.
  "X": {
    components: [{ char: "X", type: "iconic" }],
  },
  // Mutual cycle: A → B → A.
  "A": { components: [{ char: "B", type: "iconic" }] },
  "B": { components: [{ char: "A", type: "iconic" }] },
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("componentClosure includes the chars themselves", () => {
  const c = componentClosure("新年", fixtureChars);
  assert.equal(c.has("新"), true);
  assert.equal(c.has("年"), true);
});

test("componentClosure walks recursively (新 → 立, 木, 斤)", () => {
  const c = componentClosure("新", fixtureChars);
  for (const x of ["新", "立", "木", "斤"]) assert.equal(c.has(x), true, x);
});

test("componentClosure walks > one level deep (请 → 青 → 生, 井)", () => {
  const c = componentClosure("请", fixtureChars);
  for (const x of ["请", "讠", "青", "生", "井"]) {
    assert.equal(c.has(x), true, x);
  }
});

test("self-referential char doesn't loop forever", () => {
  const c = componentClosure("X", fixtureChars);
  assert.equal(c.size, 1);
  assert.equal(c.has("X"), true);
});

test("mutual cycle (A↔B) terminates and includes both", () => {
  const c = componentClosure("A", fixtureChars);
  assert.equal(c.size, 2);
  assert.equal(c.has("A"), true);
  assert.equal(c.has("B"), true);
});

test("empty query returns nothing", () => {
  assert.deepEqual(searchByComponent("", ["新年", "好"], fixtureChars), []);
});

test("non-Han query returns nothing", () => {
  assert.deepEqual(searchByComponent("hello", ["新年"], fixtureChars), []);
});

test("single-char direct component matches", () => {
  // 子 is a direct component of 学 and 好
  const r = searchByComponent("子", ["学习", "好", "新年"], fixtureChars);
  assert.deepEqual(r, ["学习", "好"]);
});

test("single-char nested component matches across multiple levels", () => {
  // 生 is in 请 (via 青), should still match
  const r = searchByComponent("生", ["请", "新年"], fixtureChars);
  assert.deepEqual(r, ["请"]);
});

test("multi-char query is AND across all chars", () => {
  // Both 子 and 女 in 好 → matches; 学 has 子 but not 女 → doesn't
  const r = searchByComponent("子女", ["学习", "好", "新年"], fixtureChars);
  assert.deepEqual(r, ["好"]);
});

test("preserves saved-list order", () => {
  // 子 in both 学 and 好; saved order is 好, 学习 → result keeps that order
  const r = searchByComponent("子", ["好", "学习", "新年"], fixtureChars);
  assert.deepEqual(r, ["好", "学习"]);
});

test("char appears as itself (no decomposition) still matches", () => {
  // 年 has no components but IS itself a char in 新年
  const r = searchByComponent("年", ["新年", "学习"], fixtureChars);
  assert.deepEqual(r, ["新年"]);
});

test("componentFrequencies counts distinct saved words per closure entry", () => {
  // 新年: closure = {新, 年, 立, 木, 斤}
  // 学习: closure = {学, 习, 子}
  // 好:   closure = {好, 女, 子}
  const f = componentFrequencies(["新年", "学习", "好"], fixtureChars);
  // 子 appears in 学习 + 好 = 2
  assert.equal(f.get("子"), 2);
  // 立 appears in 新年 only = 1
  assert.equal(f.get("立"), 1);
  // 习 appears in 学习 only = 1
  assert.equal(f.get("习"), 1);
});

test("componentFrequencies on empty saved set is empty", () => {
  const f = componentFrequencies([], fixtureChars);
  assert.equal(f.size, 0);
});

let failures = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log("✓", t.name);
  } catch (err) {
    failures++;
    console.error("✗", t.name);
    console.error(" ", err.message);
  }
}
if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log(`\n${tests.length} tests passed.`);
