// Tests for the phonetic-component build artifact + the componentSound
// seeding rule. The artifact is generated once by
// scripts/extract-phonetic-components.mjs; this test reads the file as
// it stands on disk and verifies its shape.

import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const PATH = "public/phonetic-components.json";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("artifact file exists", () => {
  assert.ok(
    existsSync(PATH),
    `${PATH} missing — run "node scripts/extract-phonetic-components.mjs"`,
  );
});

const json = existsSync(PATH) ? JSON.parse(readFileSync(PATH, "utf8")) : null;

test("artifact has top-level shape { generated, components: [] }", () => {
  assert.ok(json, "artifact failed to load");
  assert.equal(typeof json.generated, "string");
  assert.ok(Array.isArray(json.components));
});

test("at least 100 components were extracted", () => {
  assert.ok(json.components.length >= 100, `only ${json.components.length}`);
});

test("each component has char, pinyin, count, family[]", () => {
  for (const c of json.components.slice(0, 25)) {
    assert.ok(typeof c.char === "string" && c.char.length === 1, JSON.stringify(c));
    assert.ok(typeof c.pinyin === "string", JSON.stringify(c));
    assert.ok(typeof c.count === "number" && c.count > 0, JSON.stringify(c));
    assert.ok(Array.isArray(c.family) && c.family.length > 0, JSON.stringify(c));
  }
});

test("pinyin is tone-stripped (no diacritics, single reading)", () => {
  // Look for any combining-mark codepoint or semicolon in the first
  // 50 entries; either would be a regression in stripTones().
  for (const c of json.components.slice(0, 50)) {
    assert.equal(c.pinyin.normalize("NFD").includes("̀"), false, c.pinyin);
    assert.equal(c.pinyin.includes(";"), false, c.pinyin);
  }
});

test("entries are sorted by count descending", () => {
  for (let i = 1; i < json.components.length; i++) {
    assert.ok(
      json.components[i - 1].count >= json.components[i].count,
      `unsorted at ${i}: ${json.components[i - 1].count} < ${json.components[i].count}`,
    );
  }
});

test("componentSound seed rule: only single-char saved items in the list seed", () => {
  // Re-implementation of the predicate inside useReview's expectedCards
  // for componentSound.
  function shouldSeed(itemKey, phoneticKeys) {
    return [...itemKey].length === 1 && phoneticKeys.has(itemKey);
  }
  const phoneticKeys = new Set(json.components.map((c) => c.char));
  // Pick a few likely-productive components from the file itself.
  const top = json.components[0].char;
  assert.equal(shouldSeed(top, phoneticKeys), true);
  // A multi-char saved word never seeds componentSound.
  assert.equal(shouldSeed(top + top, phoneticKeys), false);
  // A single char NOT in the list doesn't seed either.
  assert.equal(shouldSeed("Z", phoneticKeys), false);
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
