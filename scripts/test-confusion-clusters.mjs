// Tests for the confusion-cluster lookup helpers.
// Run with: node scripts/test-confusion-clusters.mjs (or `npm test`).

import {
  CONFUSION_CLUSTERS,
  LEECH_LAPSES,
  clusterFor,
  neighbors,
} from "../src/lib/confusionClusters.mjs";
import assert from "node:assert/strict";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("CONFUSION_CLUSTERS is non-empty", () => {
  assert.ok(CONFUSION_CLUSTERS.length >= 10);
});

test("LEECH_LAPSES is a sensible threshold", () => {
  assert.ok(typeof LEECH_LAPSES === "number");
  assert.ok(LEECH_LAPSES >= 4 && LEECH_LAPSES <= 10);
});

test("each cluster has 2+ unique members", () => {
  for (const c of CONFUSION_CLUSTERS) {
    assert.ok(c.length >= 2, `cluster too small: ${c.join("/")}`);
    assert.equal(new Set(c).size, c.length, `duplicate in cluster: ${c.join("/")}`);
    for (const ch of c) {
      assert.ok(typeof ch === "string" && ch.length === 1, `bad char in ${c.join("/")}: ${ch}`);
    }
  }
});

test("clusterFor returns the matching cluster", () => {
  const c = clusterFor("易");
  assert.ok(c, "expected 易 to be in some cluster");
  assert.ok(c.includes("昜"));
});

test("clusterFor returns null for non-cluster chars", () => {
  assert.equal(clusterFor("吗"), null);
});

test("clusterFor returns null for non-single-character input", () => {
  assert.equal(clusterFor(""), null);
  assert.equal(clusterFor("你好"), null);
  assert.equal(clusterFor("abc"), null);
});

test("neighbors returns cluster minus the input", () => {
  const n = neighbors("己");
  assert.ok(n.includes("已"));
  assert.ok(n.includes("巳"));
  assert.equal(n.includes("己"), false);
});

test("neighbors returns [] when the char is not in any cluster", () => {
  assert.deepEqual(neighbors("吗"), []);
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
