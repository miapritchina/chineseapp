// Tests for the "expectedCards" set — the rule that decides which (item,
// kind, facet) tuples should have an FSRS card seeded for a given saved
// set. Re-implemented here against pure data (no React) so we can verify
// without a build step.

import assert from "node:assert/strict";

// Re-implements the body of the `expectedCards` useMemo in
// src/hooks/useReview.ts. Keep this in sync if the seeding rules change.
function expectedCards(
  savedWords,
  chars,
  phoneticComponentKeys = null,
  phoneticComponentsByChar = null,
  wroteKeys = null,
) {
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
  if (phoneticComponentKeys) {
    for (const key of savedWords) {
      if ([...key].length !== 1) continue;
      if (!phoneticComponentKeys.has(key)) continue;
      out.set(`component|componentSound|${key}`, {
        itemKey: key,
        itemKind: "component",
        facet: "componentSound",
      });
    }
  }
  if (wroteKeys) {
    for (const key of savedWords) {
      if ([...key].length !== 1) continue;
      if (!wroteKeys.has(key)) continue;
      out.set(`char|production|${key}`, {
        itemKey: key,
        itemKind: "char",
        facet: "production",
      });
    }
  }
  if (phoneticComponentsByChar && phoneticComponentKeys) {
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

test("single saved word seeds meaning + sound recognition cards", () => {
  const m = expectedCards(["请"], fixtureChars);
  assert.ok(m.has("word|meaningRecognition|请"));
  assert.ok(m.has("word|soundRecognition|请"));
});

test("char with a sound component also gets a phoneticTap card", () => {
  const m = expectedCards(["请"], fixtureChars);
  assert.ok(m.has("char|phoneticTap|请"));
});

test("char without a sound component does NOT get a phoneticTap card", () => {
  const m = expectedCards(["好"], fixtureChars);
  assert.ok(m.has("word|meaningRecognition|好"));
  assert.equal(m.has("char|phoneticTap|好"), false);
  // 女 + 子 are meaning components; no sound at all on 好.
  assert.equal(m.has("char|phoneticTap|女"), false);
  assert.equal(m.has("char|phoneticTap|子"), false);
});

test("multi-char word seeds phoneticTap on each char with a sound component", () => {
  const m = expectedCards(["你好"], fixtureChars);
  assert.ok(m.has("word|meaningRecognition|你好"));
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
  // Map size = 4 recognition rows (2 words × 2 facets) + 1 phoneticTap
  assert.equal(m.size, 5);
});

test("char with empty components array does not crash and gets no phoneticTap", () => {
  const m = expectedCards(["年"], fixtureChars);
  assert.equal(m.has("char|phoneticTap|年"), false);
});

test("char missing from data-chars.json is silently skipped", () => {
  const m = expectedCards(["?"], fixtureChars);
  assert.ok(m.has("word|meaningRecognition|?"));
  // 1 word × 2 recognition facets = 2 rows.
  assert.equal(m.size, 2);
});

test("componentSound seeds for saved single-char items in the phonetic list", () => {
  const m = expectedCards(["青"], fixtureChars, new Set(["青"]));
  assert.ok(m.has("component|componentSound|青"));
});

test("componentSound does NOT seed for chars not in the phonetic list", () => {
  const m = expectedCards(["年"], fixtureChars, new Set(["青"]));
  assert.equal(m.has("component|componentSound|年"), false);
});

test("familyTransfer seeds up to 2 unsaved family members per saved component", () => {
  const phoneticByChar = new Map([
    ["青", { char: "青", pinyin: "qing", family: ["请", "情", "晴", "清"] }],
  ]);
  const m = expectedCards(
    ["青"],
    fixtureChars,
    new Set(["青"]),
    phoneticByChar,
  );
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
  const m = expectedCards(
    ["青", "请"], // 请 already saved
    fixtureChars,
    new Set(["青"]),
    phoneticByChar,
  );
  // 请 is saved → skip; 情 + 晴 are next two unsaved members
  assert.equal(m.has("char|familyTransfer|请"), false);
  assert.ok(m.has("char|familyTransfer|情"));
  assert.ok(m.has("char|familyTransfer|晴"));
});

test("familyTransfer does nothing without phoneticComponents data", () => {
  const m = expectedCards(["青"], fixtureChars, new Set(["青"]));
  // No familyTransfer cards because phoneticComponentsByChar is null.
  for (const k of m.keys()) {
    assert.equal(k.startsWith("char|familyTransfer|"), false, k);
  }
});

test("production seeds for single-char saved items at wrote tier", () => {
  const m = expectedCards(["你"], fixtureChars, null, null, new Set(["你"]));
  assert.ok(m.has("char|production|你"));
});

test("production does NOT seed for multi-char saved words at wrote tier", () => {
  const m = expectedCards(["你好"], fixtureChars, null, null, new Set(["你好"]));
  assert.equal(m.has("char|production|你好"), false);
  assert.equal(m.has("char|production|你"), false);
});

test("production does NOT seed when char is saved but not in wroteKeys", () => {
  const m = expectedCards(["你"], fixtureChars, null, null, new Set());
  assert.equal(m.has("char|production|你"), false);
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
