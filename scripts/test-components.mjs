// Tests for the components-graph data builder.
// Run with: node scripts/test-components.mjs

import { buildGraph } from "../components/graph-data.mjs";
import assert from "node:assert/strict";

const fixtureChars = {
  "新": {
    pinyin: "xīn",
    components: [
      { char: "立", type: "iconic" },
      { char: "木", type: "iconic" },
      { char: "斤", type: "sound" },
    ],
  },
  "年": { pinyin: "nián", components: [] },
  "学": {
    pinyin: "xué",
    components: [{ char: "子", type: "meaning" }],
  },
  "习": { pinyin: "xí", components: [] },
  "好": {
    pinyin: "hǎo",
    components: [
      { char: "女", type: "meaning" },
      { char: "子", type: "meaning" },
    ],
  },
};

function emptySets() {
  return { learnedSet: new Set(), wroteSet: new Set() };
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("empty saved set produces empty graph", () => {
  const g = buildGraph({ savedWords: [], ...emptySets(), chars: fixtureChars });
  assert.equal(g.nodes.length, 0);
  assert.equal(g.edges.length, 0);
});

test("multi-char word fans into chars + components", () => {
  const g = buildGraph({
    savedWords: ["新年"],
    ...emptySets(),
    chars: fixtureChars,
  });
  const words = g.nodes.filter((n) => n.data.kind === "word");
  const cs = g.nodes.filter((n) => n.data.kind === "char");
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.equal(words.length, 1);
  assert.equal(words[0].data.label, "新年");
  assert.equal(words[0].data.tier, "saved");
  assert.equal(cs.length, 2);
  assert.deepEqual(new Set(cs.map((n) => n.data.label)), new Set(["新", "年"]));
  // 新 has 3 components, 年 has 0 → 3 components total
  assert.equal(comps.length, 3);
  assert.deepEqual(
    new Set(comps.map((n) => n.data.label)),
    new Set(["立", "木", "斤"]),
  );
  // Edges: 2 char→word + 3 component→char
  assert.equal(g.edges.filter((e) => e.data.kind === "cw").length, 2);
  assert.equal(g.edges.filter((e) => e.data.kind === "pc").length, 3);
});

test("char saved on its own becomes a char node, not a word", () => {
  const g = buildGraph({
    savedWords: ["新"],
    ...emptySets(),
    chars: fixtureChars,
  });
  assert.equal(g.nodes.filter((n) => n.data.kind === "word").length, 0);
  const cs = g.nodes.filter((n) => n.data.kind === "char");
  assert.equal(cs.length, 1);
  assert.equal(cs[0].data.label, "新");
  assert.equal(cs[0].data.savedAsChar, true);
  assert.equal(cs[0].data.tier, "saved");
  assert.equal(g.nodes.filter((n) => n.data.kind === "component").length, 3);
});

test("component shared with a saved char does not double-render", () => {
  const g = buildGraph({
    savedWords: ["新", "木"], // 木 saved AND a component of 新
    ...emptySets(),
    chars: fixtureChars,
  });
  const cs = g.nodes.filter((n) => n.data.kind === "char");
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.equal(cs.length, 2);
  assert.deepEqual(new Set(cs.map((n) => n.data.label)), new Set(["新", "木"]));
  // Only 立 + 斤 stay in the component layer (木 escaped to char layer)
  assert.deepEqual(new Set(comps.map((n) => n.data.label)), new Set(["立", "斤"]));
});

test("component shared across two chars has one node + two edges", () => {
  const g = buildGraph({
    savedWords: ["学习", "好"],
    ...emptySets(),
    chars: fixtureChars,
  });
  // 子 is a component of both 学 and 好 — should appear once
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  const ziNodes = comps.filter((n) => n.data.label === "子");
  assert.equal(ziNodes.length, 1);
  // Two edges from p:子 — one to c:学, one to c:好
  const ziEdges = g.edges.filter((e) => e.data.source === "p:子");
  assert.equal(ziEdges.length, 2);
  assert.deepEqual(
    new Set(ziEdges.map((e) => e.data.target)),
    new Set(["c:学", "c:好"]),
  );
});

test("learned + wrote tier colors propagate to word and char nodes", () => {
  const g = buildGraph({
    savedWords: ["新年", "学习", "好"], // 好 is one char → char node, not word
    learnedSet: new Set(["新年", "好"]),
    wroteSet: new Set(["学习"]),
    chars: fixtureChars,
  });
  const wordTier = (label) =>
    g.nodes.find((n) => n.data.kind === "word" && n.data.label === label).data.tier;
  assert.equal(wordTier("新年"), "learned");
  assert.equal(wordTier("学习"), "wrote");
  // Char saved on its own carries its own tier
  const haoNode = g.nodes.find((n) => n.data.kind === "char" && n.data.label === "好");
  assert.equal(haoNode.data.savedAsChar, true);
  assert.equal(haoNode.data.tier, "learned");
  // Char that's only inside a word (e.g. 新) has no tier of its own
  const xinNode = g.nodes.find((n) => n.data.kind === "char" && n.data.label === "新");
  assert.equal(xinNode.data.savedAsChar, false);
  assert.equal(xinNode.data.tier, null);
});

test("characterless component (◎) is filtered out", () => {
  const charsWithMeta = {
    "事": {
      components: [
        { char: "◎", type: "unknown" },
        { char: "亅", type: "iconic" },
      ],
    },
  };
  const g = buildGraph({
    savedWords: ["事"],
    ...emptySets(),
    chars: charsWithMeta,
  });
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.equal(comps.length, 1);
  assert.equal(comps[0].data.label, "亅");
});

test("repeated char in a word produces one char node + one edge", () => {
  const charsLin = {
    "林": {
      components: [
        { char: "木", type: "iconic" },
        { char: "木", type: "iconic" },
      ],
    },
  };
  const g = buildGraph({
    savedWords: ["林林"], // contrived: same char twice
    ...emptySets(),
    chars: charsLin,
  });
  const cs = g.nodes.filter((n) => n.data.kind === "char");
  assert.equal(cs.length, 1);
  // Even though 林 appears twice in the word, just one char→word edge
  const cw = g.edges.filter((e) => e.data.kind === "cw");
  assert.equal(cw.length, 1);
  // 木 listed twice in components — should still only appear once
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.equal(comps.length, 1);
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
