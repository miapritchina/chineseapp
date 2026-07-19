// Shape + integrity checks for public/sanzijing.json — the Three
// Character Classic data behind the #/classic page.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../public/sanzijing.json", import.meta.url), "utf-8"));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("standard edition: 178 couplets = 356 lines = 1068 characters", () => {
  assert.equal(data.couplets.length, 178);
});

test("every line is exactly 3 CJK characters", () => {
  for (const { a, b } of data.couplets) {
    for (const line of [a, b]) {
      const glyphs = [...line];
      assert.equal(glyphs.length, 3, line);
      for (const g of glyphs) assert.match(g, /[一-鿿]/, line);
    }
  }
});

test("every couplet has a non-empty English translation", () => {
  for (const { en } of data.couplets) {
    assert.ok(typeof en === "string" && en.trim().length > 3, en);
  }
});

test("text is simplified (spot landmarks)", () => {
  const all = data.couplets.map((c) => c.a + c.b).join("");
  assert.ok(all.includes("习相远"), "习相远 (not 習相遠)");
  assert.ok(all.includes("宜勉力"), "ends with 宜勉力");
  assert.ok(all.startsWith("人之初性本善"));
  assert.ok(!all.includes("習") && !all.includes("學"), "no traditional forms");
});

test("title + source metadata present", () => {
  assert.equal(data.title, "三字经");
  assert.ok(data.titleEn.length > 0);
  assert.ok(/Giles/.test(data.source));
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
