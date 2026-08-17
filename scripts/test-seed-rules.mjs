// Tests for the seed entry-selection rules (scripts/seed-rules.mjs).
// Regression suite for the 笑 bug: the "old variant of 笑" entry (trad
// 咲, same simp) used to win the dedup and erase "to laugh" from the
// dictionary. Run with: node scripts/test-seed-rules.mjs (or npm test).

import assert from "node:assert/strict";
import { dedupBySimp, isCrossRefDef, isOnlyCrossRef } from "./seed-rules.mjs";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("isCrossRefDef catches prefixed variant forms", () => {
  assert.ok(isCrossRefDef("variant of 笑[xiào]"));
  assert.ok(isCrossRefDef("old variant of 笑[xiào]"));
  assert.ok(isCrossRefDef("archaic variant of 麼[me]"));
  assert.ok(isCrossRefDef("erhua variant of 一塊|一块[yī kuài]"));
  assert.ok(isCrossRefDef("see 什么[shén me]"));
  assert.ok(isCrossRefDef("also written 好[hǎo]"));
});

test("isCrossRefDef leaves real definitions alone", () => {
  assert.ok(!isCrossRefDef("to laugh; to smile"));
  assert.ok(!isCrossRefDef("a variant of the common cold")); // mid-def phrase, no hanzi target shape
  assert.ok(!isCrossRefDef("ten"));
});

test("isOnlyCrossRef: all-crossref or empty entries are droppable", () => {
  assert.ok(isOnlyCrossRef({ definitions: ["old variant of 笑[xiào]"] }));
  assert.ok(isOnlyCrossRef({ definitions: [] }));
  assert.ok(!isOnlyCrossRef({ definitions: ["old variant of 笑[xiào]", "to laugh"] }));
});

test("dedupBySimp keeps the entry with substantive definitions (笑 regression)", () => {
  const variant = {
    simp: "笑",
    trad: "咲",
    definitions: ["old variant of 笑[xiào]"],
    statistics: { movieWordRank: 504 },
  };
  const laugh = {
    simp: "笑",
    trad: "笑",
    definitions: ["to laugh", "to smile"],
    statistics: { movieWordRank: 504 },
  };
  // The variant sorts first (咲 < 笑 by codepoint) — it must still lose.
  const out = dedupBySimp([variant, laugh]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].definitions, ["to laugh", "to smile"]);
});

test("dedupBySimp ties on substance break by frequency rank", () => {
  const rare = { simp: "干", definitions: ["shield"], statistics: { movieWordRank: 9000 } };
  const common = { simp: "干", definitions: ["to do"], statistics: { movieWordRank: 100 } };
  assert.deepEqual(dedupBySimp([rare, common])[0].definitions, ["to do"]);
});

test("dedupBySimp preserves order and unique entries", () => {
  const a = { simp: "一", definitions: ["one"], statistics: {} };
  const b = { simp: "二", definitions: ["two"], statistics: {} };
  assert.deepEqual(
    dedupBySimp([a, b]).map((e) => e.simp),
    ["一", "二"],
  );
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(err.message);
  }
}
console.log(`\n${tests.length - failed} tests passed.`);
if (failed > 0) process.exit(1);
