// Tests for the cluster-recall picker (src/components/ClusterRecall.tsx).
// Re-implements pickCluster against pure data so we can verify without
// React. Keep in sync if the picking strategy changes.

import assert from "node:assert/strict";

const TARGET_SIZE = 4;
const MIN_SIZE = 3;

function pickCluster(savedKeys, chars, phoneticComponentsByChar) {
  if (savedKeys.length < MIN_SIZE) return null;
  if (phoneticComponentsByChar) {
    for (const [comp, info] of phoneticComponentsByChar) {
      const family = new Set(info.family || []);
      family.add(comp);
      const matches = savedKeys.filter((w) => {
        for (const c of w) if (family.has(c)) return true;
        return false;
      });
      if (matches.length >= MIN_SIZE) return matches.slice(0, TARGET_SIZE);
    }
  }
  const charCounts = new Map();
  for (const w of savedKeys) {
    for (const c of new Set(w)) {
      const arr = charCounts.get(c) || [];
      arr.push(w);
      charCounts.set(c, arr);
    }
  }
  const shared = [...charCounts.entries()]
    .filter(([, ws]) => ws.length >= MIN_SIZE)
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (shared) return shared[1].slice(0, TARGET_SIZE);
  // Deterministic fallback for testability: use stable order rather
  // than the production Fisher-Yates. The test exercises only the
  // structural guarantees (size, dedup) — order doesn't matter for
  // this branch's contract.
  return savedKeys.slice(0, TARGET_SIZE);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("returns null below MIN_SIZE saved keys", () => {
  assert.equal(pickCluster([], {}, null), null);
  assert.equal(pickCluster(["a"], {}, null), null);
  assert.equal(pickCluster(["a", "b"], {}, null), null);
});

test("prefers a phonetic-component family when ≥ MIN_SIZE members match", () => {
  const byChar = new Map([
    [
      "青",
      { char: "青", pinyin: "qing", family: ["请", "情", "晴", "清"] },
    ],
  ]);
  const r = pickCluster(["请", "情", "清", "你好"], {}, byChar);
  assert.ok(r);
  assert.equal(r.length <= TARGET_SIZE, true);
  // Returned cluster is the 3 family members; 你好 is excluded.
  assert.deepEqual(r, ["请", "情", "清"]);
});

test("falls back to shared-character cluster when no phonetic family hits", () => {
  // Three saved words literally share the char 子 → shared-char cluster
  // picks them. (pickCluster's shared-char branch looks at the word's
  // own chars, not their component decomposition.)
  const r = pickCluster(["子女", "子弹", "弟子", "新年"], {}, null);
  assert.ok(r);
  assert.equal(r.length >= MIN_SIZE, true);
  // 新年 doesn't contain 子 → excluded.
  assert.equal(r.includes("新年"), false);
});

test("falls back to plain sample when nothing clusters", () => {
  const saved = ["甲", "乙", "丙", "丁", "戊"]; // pairwise distinct chars
  const r = pickCluster(saved, {}, null);
  assert.ok(r);
  assert.equal(r.length, TARGET_SIZE);
});

test("caps result at TARGET_SIZE even when more match", () => {
  const byChar = new Map([
    [
      "青",
      { char: "青", pinyin: "qing", family: ["请", "情", "晴", "清", "倩"] },
    ],
  ]);
  const r = pickCluster(["请", "情", "晴", "清", "倩"], {}, byChar);
  assert.ok(r);
  assert.equal(r.length, TARGET_SIZE);
});

test("phonetic family branch counts a word containing ANY family char", () => {
  // Multi-char word 请假 contains 请 (in the 青 family).
  const byChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: ["请", "情", "晴"] }],
  ]);
  const r = pickCluster(["请假", "情", "晴", "你"], {}, byChar);
  assert.ok(r);
  // 请假 + 情 + 晴 share the family → cluster.
  assert.equal(r.includes("请假"), true);
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
