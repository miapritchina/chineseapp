// Tests for src/lib/bugReport.ts → describePage (the page-label logic behind
// a bug report's auto-captured context). Run: node scripts/test-bug-report.mjs
//
// describePage is a pure function; mirror it here (same pattern as
// test-share.mjs). Keep in sync with src/lib/bugReport.ts.

import assert from "node:assert/strict";

function describePage({ hash, top, sentenceMode }) {
  if (top) {
    const kind = top.kind === "word" ? "Word" : "Character";
    return `${kind} ${top.view === "tree" ? "tree" : "sheet"}`;
  }
  if (sentenceMode) return "Sentence Studio";
  switch (hash) {
    case "#/review":
      return "Review";
    case "#/cards":
      return "Flashcards";
    case "#/explore":
      return "Explore";
    case "#/classic":
      return "三字经 Classic";
    case "#/stats":
      return "Stats";
    default:
      return "Home";
  }
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("bare home hash → Home", () => {
  assert.equal(describePage({ hash: "", top: null, sentenceMode: false }), "Home");
  assert.equal(describePage({ hash: "#/", top: null, sentenceMode: false }), "Home");
});

test("full-page routes map to their labels", () => {
  const cases = {
    "#/review": "Review",
    "#/cards": "Flashcards",
    "#/explore": "Explore",
    "#/classic": "三字经 Classic",
    "#/stats": "Stats",
  };
  for (const [hash, label] of Object.entries(cases)) {
    assert.equal(describePage({ hash, top: null, sentenceMode: false }), label);
  }
});

test("an open word sheet wins over the underlying route", () => {
  assert.equal(
    describePage({ hash: "#/explore", top: { kind: "word", key: "你好" }, sentenceMode: false }),
    "Word sheet",
  );
});

test("char tree vs char sheet", () => {
  assert.equal(
    describePage({ hash: "", top: { kind: "char", key: "好", view: "tree" }, sentenceMode: false }),
    "Character tree",
  );
  assert.equal(
    describePage({ hash: "", top: { kind: "char", key: "好", view: "sheet" }, sentenceMode: false }),
    "Character sheet",
  );
});

test("sentence mode has no hash but still labels", () => {
  assert.equal(describePage({ hash: "", top: null, sentenceMode: true }), "Sentence Studio");
});

test("an open sheet still wins over sentence mode", () => {
  assert.equal(
    describePage({ hash: "", top: { kind: "word", key: "学习" }, sentenceMode: true }),
    "Word sheet",
  );
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
