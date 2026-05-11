// Tests for src/lib/mnemonics.ts → buildStarterMnemonic.
// Run with: node scripts/test-mnemonics.mjs

import assert from "node:assert/strict";

// Re-implement buildStarterMnemonic against pure data so we don't need
// to load the TS source. Keep this in sync with src/lib/mnemonics.ts.
function buildStarterMnemonic(char, cd) {
  if (!cd) return char;
  const parts = (cd.components || []).filter((c) => c?.char && c.char !== "◎");
  if (parts.length === 0) {
    const def = cd.definitions?.[0] || "";
    return def ? `${char} = ${def}` : char;
  }
  const piece = (c) => {
    const tag =
      c.type === "sound" ? c.pinyin || "" : c.definition || "";
    return tag ? `${c.char} (${tag})` : c.char;
  };
  return parts.map(piece).join(" + ") + ` → ${char}`;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("char with no data returns the char alone", () => {
  assert.equal(buildStarterMnemonic("?", undefined), "?");
});

test("char with no components falls back to first definition", () => {
  const cd = { definitions: ["one"] };
  assert.equal(buildStarterMnemonic("一", cd), "一 = one");
});

test("char with no components AND no definitions returns the char alone", () => {
  assert.equal(buildStarterMnemonic("X", { definitions: [] }), "X");
});

test("annotates sound component with its pinyin, meaning with definition", () => {
  const cd = {
    components: [
      { char: "氵", type: "meaning", definition: "water" },
      { char: "青", type: "sound", pinyin: "qing" },
    ],
  };
  assert.equal(buildStarterMnemonic("清", cd), "氵 (water) + 青 (qing) → 清");
});

test("characterless ◎ components are filtered out", () => {
  const cd = {
    components: [
      { char: "◎", type: "unknown" },
      { char: "亅", type: "iconic", definition: "hook" },
    ],
  };
  assert.equal(buildStarterMnemonic("事", cd), "亅 (hook) → 事");
});

test("repeated components are kept (mirrors structural display)", () => {
  const cd = {
    components: [
      { char: "木", type: "iconic", definition: "tree" },
      { char: "木", type: "iconic", definition: "tree" },
    ],
  };
  assert.equal(buildStarterMnemonic("林", cd), "木 (tree) + 木 (tree) → 林");
});

test("missing pinyin / definition collapses to just the char", () => {
  const cd = {
    components: [{ char: "X", type: "sound" }],
  };
  assert.equal(buildStarterMnemonic("Y", cd), "X → Y");
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
