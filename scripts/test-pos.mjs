// Tests for the POS heuristic in src/lib/pos.ts.
// Run with: node scripts/test-pos.mjs
//
// Re-implements detectPos against pure data so the test doesn't need to
// load TS source. Keep in sync with src/lib/pos.ts.

import assert from "node:assert/strict";

const PRONOUNS = new Set([
  "我", "你", "他", "她", "它", "您",
  "我们", "你们", "他们", "她们", "它们",
  "自己", "大家", "谁", "什么", "哪", "哪儿", "哪里", "怎么", "这", "那",
]);
const PARTICLES = new Set([
  "的", "了", "着", "过", "得", "地",
  "吗", "呢", "吧", "啊", "呀", "哦", "嘛", "呐",
]);
const CONJUNCTIONS = new Set([
  "和", "或", "但", "但是", "可是", "而", "而且", "因为", "所以",
  "如果", "虽然", "然后", "或者", "并且", "不过",
]);
const ADVERB_GLOSSES = new Set([
  "very", "also", "too", "all", "both", "still", "already",
  "often", "again", "only", "just", "just right", "always",
  "really", "perhaps", "maybe", "indeed", "actually", "almost",
]);
const ADJECTIVE_GLOSSES = new Set([
  "good", "bad", "hot", "cold", "big", "small", "old", "new",
  "happy", "sad", "tall", "short", "beautiful", "fast", "slow",
  "tired", "busy", "free", "right", "wrong", "easy", "hard",
  "long", "open", "close", "high", "low", "many", "few",
  "expensive", "cheap", "tasty", "delicious",
]);

function detectPos(word) {
  const w = word.word;
  if (PRONOUNS.has(w)) return "pron";
  if (PARTICLES.has(w)) return "part";
  if (CONJUNCTIONS.has(w)) return "conj";
  const d = ((word.definitions && word.definitions[0]) || "").trim().toLowerCase();
  if (/^to /.test(d) || /^to\b/.test(d)) return "v";
  if (/\bparticle\b/.test(d) || /\baspect\b/.test(d) || /^\(question/.test(d)) return "part";
  if (ADVERB_GLOSSES.has(d)) return "adv";
  if (ADJECTIVE_GLOSSES.has(d)) return "adj";
  return "n";
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("pronoun lookup wins over definition", () => {
  assert.equal(detectPos({ word: "我", definitions: ["I; me"] }), "pron");
});

test("particle lookup classifies 的", () => {
  assert.equal(detectPos({ word: "的", definitions: ["(possessive particle)"] }), "part");
});

test("conjunction lookup classifies 和", () => {
  assert.equal(detectPos({ word: "和", definitions: ["and"] }), "conj");
});

test("verb detected from 'to ' prefix", () => {
  assert.equal(detectPos({ word: "喝", definitions: ["to drink"] }), "v");
});

test("adjective detected from gloss table", () => {
  assert.equal(detectPos({ word: "好", definitions: ["good"] }), "adj");
});

test("adverb detected from gloss table", () => {
  assert.equal(detectPos({ word: "很", definitions: ["very"] }), "adv");
});

test("unknown gloss falls back to noun", () => {
  assert.equal(detectPos({ word: "茶", definitions: ["tea"] }), "n");
});

test("missing definitions still returns noun", () => {
  assert.equal(detectPos({ word: "茶" }), "n");
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}`);
    console.error(e.message);
  }
}
console.log(`\n${tests.length - failed} tests passed.${failed ? ` ${failed} failed.` : ""}`);
process.exit(failed ? 1 : 0);
