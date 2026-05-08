// Tests for the "expectedCards" set — the rule that decides which (item,
// kind, facet) tuples should have an FSRS card seeded for a given saved
// set. Re-implemented here against pure data (no React) so we can verify
// without a build step.

import assert from "node:assert/strict";

// Re-implements the body of the `expectedCards` useMemo in
// src/hooks/useReview.ts. Keep this in sync if the seeding rules change.
function expectedCards(savedWords, chars) {
  const out = new Map();
  for (const key of savedWords) {
    out.set(`word|recognition|${key}`, {
      itemKey: key,
      itemKind: "word",
      facet: "recognition",
    });
  }
  for (const key of savedWords) {
    for (const c of key) {
      const cd = chars[c];
      if (!cd?.components) continue;
      if (cd.components.some((x) => x?.type === "sound" && x.char)) {
        out.set(`char|phoneticTap|${c}`, {
          itemKey: c,
          itemKind: "char",
          facet: "phoneticTap",
        });
      }
    }
  }
  return out;
}

const fixtureChars = {
  "请": { components: [{ char: "讠", type: "meaning" }, { char: "青", type: "sound" }] },
  "新": { components: [{ char: "立", type: "iconic" }, { char: "辛", type: "sound" }, { char: "斤", type: "iconic" }] },
  "年": { components: [] },
  "好": { components: [{ char: "女", type: "meaning" }, { char: "子", type: "meaning" }] },
  "你": { components: [{ char: "亻", type: "meaning" }, { char: "尔", type: "sound" }] },
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("empty saved set produces no cards", () => {
  const m = expectedCards([], fixtureChars);
  assert.equal(m.size, 0);
});

test("single saved word seeds a recognition card", () => {
  const m = expectedCards(["请"], fixtureChars);
  assert.ok(m.has("word|recognition|请"));
});

test("char with a sound component also gets a phoneticTap card", () => {
  const m = expectedCards(["请"], fixtureChars);
  assert.ok(m.has("char|phoneticTap|请"));
});

test("char without a sound component does NOT get a phoneticTap card", () => {
  const m = expectedCards(["好"], fixtureChars);
  assert.ok(m.has("word|recognition|好"));
  assert.equal(m.has("char|phoneticTap|好"), false);
  // 女 + 子 are meaning components; no sound at all on 好.
  assert.equal(m.has("char|phoneticTap|女"), false);
  assert.equal(m.has("char|phoneticTap|子"), false);
});

test("multi-char word seeds phoneticTap on each char with a sound component", () => {
  const m = expectedCards(["你好"], fixtureChars);
  assert.ok(m.has("word|recognition|你好"));
  // 你 has sound=尔 → phoneticTap on 你
  assert.ok(m.has("char|phoneticTap|你"));
  // 好 has no sound component → no phoneticTap
  assert.equal(m.has("char|phoneticTap|好"), false);
});

test("two saved words sharing a char dedupe to one phoneticTap card", () => {
  // 请 appears in both. If we saved both, only one phoneticTap row.
  const m = expectedCards(["请", "请假"], {
    ...fixtureChars,
    "假": { components: [{ char: "亻", type: "meaning" }] },
  });
  assert.ok(m.has("char|phoneticTap|请"));
  // Map size = 2 word-recognition + 1 phoneticTap
  assert.equal(m.size, 3);
});

test("char with empty components array does not crash and gets no phoneticTap", () => {
  const m = expectedCards(["年"], fixtureChars);
  assert.equal(m.has("char|phoneticTap|年"), false);
});

test("char missing from data-chars.json is silently skipped", () => {
  const m = expectedCards(["?"], fixtureChars);
  assert.ok(m.has("word|recognition|?"));
  assert.equal(m.size, 1);
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
