// Tests for the "expectedCards" set — the rule that decides which (item,
// kind, facet) tuples should have an FSRS card seeded for a given saved
// set. Re-implemented here against pure data (no React) so we can verify
// without a build step.
//
// The retired phoneticTap / componentSound drills (dropped from the
// launch screen in v85) must never seed — they inflated the due badge
// and ate the daily new-card cap with rows that could never surface.

import assert from "node:assert/strict";

// Re-implements the body of the `expectedCards` useMemo in
// src/hooks/useReview.ts. Keep this in sync if the seeding rules change.
function expectedCards(savedWords, phoneticComponentsByChar = null, chars = {}) {
  const out = new Map();
  const saved = new Set(savedWords);
  for (const key of savedWords) {
    out.set(`word|meaningRecognition|${key}`, {
      itemKey: key,
      itemKind: "word",
      facet: "meaningRecognition",
    });
    out.set(`word|soundRecognition|${key}`, {
      itemKey: key,
      itemKind: "word",
      facet: "soundRecognition",
    });
    out.set(`word|reverseRecognition|${key}`, {
      itemKey: key,
      itemKind: "word",
      facet: "reverseRecognition",
    });
    if ([...key].length >= 2) {
      out.set(`word|clozeChar|${key}`, {
        itemKey: key,
        itemKind: "word",
        facet: "clozeChar",
      });
    }
  }
  for (const key of savedWords) {
    if ([...key].length !== 1) continue;
    out.set(`char|production|${key}`, {
      itemKey: key,
      itemKind: "char",
      facet: "production",
    });
  }
  return out;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("empty saved set produces no cards", () => {
  const m = expectedCards([]);
  assert.equal(m.size, 0);
});

test("single saved char seeds meaning + sound + reverse + production (no cloze)", () => {
  const m = expectedCards(["请"]);
  assert.ok(m.has("word|meaningRecognition|请"));
  assert.ok(m.has("word|soundRecognition|请"));
  assert.ok(m.has("word|reverseRecognition|请"));
  assert.ok(m.has("char|production|请"));
  assert.equal(m.has("word|clozeChar|请"), false);
  assert.equal(m.size, 4);
});

test("multi-char saved word additionally seeds a cloze card", () => {
  const m = expectedCards(["你好"]);
  assert.ok(m.has("word|clozeChar|你好"));
});

test("familySweep never seeds FSRS rows (retired v137 — the sweep is an ungraded game)", () => {
  const byChar = new Map([["青", { char: "青", family: ["请", "情", "晴", "清"] }]]);
  const chars = { 请: {}, 情: {}, 晴: {}, 清: {} };
  const m = expectedCards(["青"], byChar, chars);
  assert.equal([...m.keys()].some((k) => k.includes("familySweep")), false);
});

test("retired phoneticTap facet never seeds", () => {
  // 请 has a sound component (青) — before the drop this seeded a
  // char|phoneticTap|请 row.
  const m = expectedCards(["请", "你好"]);
  for (const k of m.keys()) {
    assert.equal(k.includes("phoneticTap"), false, k);
  }
});

test("retired componentSound facet never seeds", () => {
  const phoneticByChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: [] }],
  ]);
  const m = expectedCards(["青"], phoneticByChar);
  for (const k of m.keys()) {
    assert.equal(k.includes("componentSound"), false, k);
  }
});

test("retired familyTransfer facet never seeds (v107)", () => {
  const phoneticByChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: ["请", "情", "晴", "清"] }],
  ]);
  const m = expectedCards(["青"], phoneticByChar);
  for (const k of m.keys()) {
    assert.equal(k.includes("familyTransfer"), false, k);
  }
});

test("production seeds for every saved single character (v99)", () => {
  const m = expectedCards(["你"]);
  assert.ok(m.has("char|production|你"));
});

test("production does NOT seed for multi-char saved words", () => {
  const m = expectedCards(["你好"]);
  assert.equal(m.has("char|production|你好"), false);
  assert.equal(m.has("char|production|你"), false);
});

// --- Queue ordering (mirrors the dueCards sort; the daily cap was
// removed in v102 / ADR-0012 — everything due surfaces) ---

function orderDue(rows) {
  const tier = (r) => (r.facet === "reverseRecognition" || r.facet === "clozeChar" ? 1 : 0);
  return rows.slice().sort((a, b) => {
    const ka = a.itemKind === "word" ? 1 : 0;
    const kb = b.itemKind === "word" ? 1 : 0;
    if (ka !== kb) return ka - kb;
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    return a.dueAt - b.dueAt;
  });
}

test("no cap: every due card surfaces regardless of count", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    itemKey: String(i),
    itemKind: "word",
    facet: "meaningRecognition",
    dueAt: i,
  }));
  assert.equal(orderDue(rows).length, 100);
});

test("meaning/sound sort before reverse/cloze within word kind", () => {
  const rows = [
    { itemKey: "a", itemKind: "word", facet: "reverseRecognition", dueAt: 1 },
    { itemKey: "b", itemKind: "word", facet: "meaningRecognition", dueAt: 2 },
    { itemKey: "c", itemKind: "word", facet: "clozeChar", dueAt: 0 },
  ];
  assert.deepEqual(
    orderDue(rows).map((r) => r.facet),
    ["meaningRecognition", "clozeChar", "reverseRecognition"],
  );
});

test("char/component cards sort before word cards", () => {
  const rows = [
    { itemKey: "w", itemKind: "word", facet: "meaningRecognition", dueAt: 0 },
    { itemKey: "c", itemKind: "char", facet: "production", dueAt: 5 },
  ];
  assert.equal(orderDue(rows)[0].itemKind, "char");
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
