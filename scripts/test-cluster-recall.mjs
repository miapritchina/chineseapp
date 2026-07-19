// Tests for the cluster-recall partition (src/lib/drillGen.ts
// buildClusters). Re-implemented against pure data so we can verify
// without a build step. Keep in sync if the strategy changes.
//
// v103: one launch walks EVERY cluster the saved set can form (each
// word used at most once), instead of returning a single group.

import assert from "node:assert/strict";

const TARGET = 4;
const MIN = 3;
const rand0 = () => 0; // identity shuffle

function shuffle(arr, rand) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function buildClusters(savedKeys, phoneticComponentsByChar, rand = rand0) {
  const unused = new Set(savedKeys);
  const clusters = [];
  const take = (members) => {
    const group = members.slice(0, TARGET);
    for (const w of group) unused.delete(w);
    clusters.push(group);
  };
  if (phoneticComponentsByChar) {
    for (const [comp, info] of phoneticComponentsByChar) {
      const family = new Set(info.family || []);
      family.add(comp);
      const matches = [...unused].filter((w) => [...w].some((c) => family.has(c)));
      if (matches.length >= MIN) take(matches);
    }
  }
  for (;;) {
    const counts = new Map();
    for (const w of unused) {
      for (const c of new Set(w)) {
        const arr = counts.get(c) || [];
        arr.push(w);
        counts.set(c, arr);
      }
    }
    const best = [...counts.values()]
      .filter((ws) => ws.length >= MIN)
      .sort((a, b) => b.length - a.length)[0];
    if (!best) break;
    take(best);
  }
  const rest = shuffle([...unused], rand);
  for (let i = 0; i + MIN <= rest.length; i += TARGET) {
    const group = rest.slice(i, i + TARGET);
    if (group.length >= MIN) clusters.push(group);
  }
  return shuffle(clusters, rand);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("empty / tiny saved sets produce no clusters", () => {
  assert.deepEqual(buildClusters([], null), []);
  assert.deepEqual(buildClusters(["a", "b"], null), []);
});

test("phonetic family forms the first cluster; leftovers group by shared char", () => {
  const byChar = new Map([["青", { char: "青", family: ["请", "情", "晴", "清"] }]]);
  const saved = ["请", "情", "清", "子女", "子弹", "弟子", "独"];
  const clusters = buildClusters(saved, byChar);
  // Family cluster 请/情/清 + shared-子 cluster; 独 (singleton) dropped.
  assert.equal(clusters.length, 2);
  const flat = clusters.flat();
  assert.ok(["请", "情", "清"].every((w) => flat.includes(w)));
  assert.ok(["子女", "子弹", "弟子"].every((w) => flat.includes(w)));
  assert.equal(flat.includes("独"), false);
});

test("every word is used at most once across clusters", () => {
  const byChar = new Map([["青", { char: "青", family: ["请", "情", "晴", "清"] }]]);
  const saved = ["请", "情", "晴", "清", "请假", "子女", "子弹", "弟子"];
  const flat = buildClusters(saved, byChar).flat();
  assert.equal(new Set(flat).size, flat.length);
});

test("large unrelated sets partition into random groups of 3-4, none smaller", () => {
  const saved = [..."甲乙丙丁戊己庚辛壬癸"]; // 10 distinct singles
  const clusters = buildClusters(saved, null);
  assert.ok(clusters.length >= 2);
  for (const c of clusters) {
    assert.ok(c.length >= MIN && c.length <= TARGET, String(c));
  }
});

test("clusters cap at 4 members even when more relate", () => {
  const byChar = new Map([["青", { char: "青", family: ["请", "情", "晴", "清", "倩", "精"] }]]);
  const clusters = buildClusters(["请", "情", "晴", "清", "倩", "精"], byChar);
  for (const c of clusters) assert.ok(c.length <= TARGET, String(c));
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
