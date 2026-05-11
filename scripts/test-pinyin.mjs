// Tests for src/lib/pinyin.ts → normalizePinyin / tonePattern / toneLabel.
// Run with: node scripts/test-pinyin.mjs

import assert from "node:assert/strict";

// Mirror normalizePinyin from src/lib/pinyin.ts (regex constants kept
// in sync). Tests pin the behavior end users actually see in the
// search bar.
function normalizePinyin(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// Mirror tonePattern / toneLabel from src/lib/pinyin.ts.
const TONE_MARK = { 0x0304: 1, 0x0301: 2, 0x030c: 3, 0x0300: 4 };
function tonePattern(pinyin) {
  if (!pinyin) return "";
  const syllables = pinyin.normalize("NFD").split(/\s+/).filter(Boolean);
  if (syllables.length === 0) return "";
  return syllables
    .map((s) => {
      for (const ch of s) {
        const t = TONE_MARK[ch.charCodeAt(0)];
        if (t) return String(t);
      }
      return "0";
    })
    .join(" ");
}
function toneLabel(pinyin) {
  const p = tonePattern(pinyin);
  if (!p) return "";
  const parts = p.split(" ");
  return parts.length === 1 ? `TONE ${parts[0]}` : `TONES ${p}`;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("strips first-tone macron", () => {
  assert.equal(normalizePinyin("mā"), "ma");
});

test("strips fourth-tone grave", () => {
  assert.equal(normalizePinyin("zài"), "zai");
});

test("strips third-tone caron", () => {
  assert.equal(normalizePinyin("nǐ"), "ni");
});

test("strips spaces between syllables", () => {
  assert.equal(normalizePinyin("lǎo shī"), "laoshi");
});

test("lowercases capitals", () => {
  assert.equal(normalizePinyin("Hǎo"), "hao");
});

test("passes through ASCII unchanged", () => {
  assert.equal(normalizePinyin("hello"), "hello");
});

test("empty and falsy input → empty string", () => {
  assert.equal(normalizePinyin(""), "");
  assert.equal(normalizePinyin(null), "");
  assert.equal(normalizePinyin(undefined), "");
});

test("ü is stripped to plain u — searchable by 'nu'", () => {
  // After NFD, ǚ decomposes to u + combining-caron + combining-diaeresis.
  // The regex strips both diacritics, leaving a plain "u". This is
  // intentional: the search bar shouldn't require typing ü.
  assert.equal(normalizePinyin("nǚ"), "nu");
});

test("tonePattern reads per-syllable tone numbers", () => {
  assert.equal(tonePattern("hǎo"), "3");
  assert.equal(tonePattern("xīn nián"), "1 2");
  assert.equal(tonePattern("shàng hǎi"), "4 3");
  assert.equal(tonePattern("ma ma"), "0 0"); // neutral / unmarked
  assert.equal(tonePattern(""), "");
});

test("toneLabel formats a short header label", () => {
  assert.equal(toneLabel("hǎo"), "TONE 3");
  assert.equal(toneLabel("xīn nián"), "TONES 1 2");
  assert.equal(toneLabel(""), "");
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
