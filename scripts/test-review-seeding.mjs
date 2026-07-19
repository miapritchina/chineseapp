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
  if (phoneticComponentsByChar && phoneticComponentsByChar.size > 0 && chars) {
    for (const key of savedWords) {
      if ([...key].length !== 1) continue;
      const comp = phoneticComponentsByChar.get(key);
      if (!comp?.family) continue;
      const usable = comp.family.filter((f) => f && f !== comp.char && chars[f]);
      if (usable.length < 3) continue;
      out.set(`component|familySweep|${key}`, {
        itemKey: key,
        itemKind: "component",
        facet: "familySweep",
      });
    }
  }
  if (phoneticComponentsByChar && phoneticComponentsByChar.size > 0) {
    const FAMILY_PER_COMPONENT = 2;
    for (const key of savedWords) {
      if ([...key].length !== 1) continue;
      const comp = phoneticComponentsByChar.get(key);
      if (!comp || !comp.family || comp.family.length === 0) continue;
      let added = 0;
      for (const fam of comp.family) {
        if (added >= FAMILY_PER_COMPONENT) break;
        if (!fam || fam === comp.char) continue;
        if (saved.has(fam)) continue;
        out.set(`char|familyTransfer|${fam}`, {
          itemKey: fam,
          itemKind: "char",
          facet: "familyTransfer",
        });
        added++;
      }
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

test("familySweep seeds only for components with 3+ usable family members", () => {
  const byChar = new Map([
    ["青", { char: "青", family: ["请", "情", "晴", "清"] }],
    ["尔", { char: "尔", family: ["你", "您"] }],
  ]);
  const chars = { 请: {}, 情: {}, 晴: {}, 清: {}, 你: {}, 您: {} };
  const m = expectedCards(["青", "尔"], byChar, chars);
  assert.ok(m.has("component|familySweep|青"));
  assert.equal(m.has("component|familySweep|尔"), false); // only 2 members
});

test("familySweep ignores family members missing from data-chars", () => {
  const byChar = new Map([["青", { char: "青", family: ["请", "情", "晴"] }]]);
  const chars = { 请: {}, 情: {} }; // 晴 missing → only 2 usable
  const m = expectedCards(["青"], byChar, chars);
  assert.equal(m.has("component|familySweep|青"), false);
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

test("familyTransfer seeds up to 2 unsaved family members per saved component", () => {
  const phoneticByChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: ["请", "情", "晴", "清"] }],
  ]);
  const m = expectedCards(["青"], phoneticByChar);
  // Cap is 2 per component, picks first members from family[]
  assert.ok(m.has("char|familyTransfer|请"));
  assert.ok(m.has("char|familyTransfer|情"));
  // Beyond cap → no card seeded
  assert.equal(m.has("char|familyTransfer|晴"), false);
});

test("familyTransfer skips members the user has already saved", () => {
  const phoneticByChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: ["请", "情", "晴"] }],
  ]);
  const m = expectedCards(["青", "请"], phoneticByChar); // 请 already saved
  // 请 is saved → skip; 情 + 晴 are next two unsaved members
  assert.equal(m.has("char|familyTransfer|请"), false);
  assert.ok(m.has("char|familyTransfer|情"));
  assert.ok(m.has("char|familyTransfer|晴"));
});

test("familyTransfer does nothing without phoneticComponents data", () => {
  const m = expectedCards(["青"]);
  for (const k of m.keys()) {
    assert.equal(k.startsWith("char|familyTransfer|"), false, k);
  }
});

test("familyTransfer only applies to saved single-char items", () => {
  const phoneticByChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: ["请"] }],
  ]);
  const m = expectedCards(["青青"], phoneticByChar);
  assert.equal(m.has("char|familyTransfer|请"), false);
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
