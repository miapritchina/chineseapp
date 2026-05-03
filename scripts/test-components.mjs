// Tests for the components-graph data builder.
// Run with: node scripts/test-components.mjs (or `npm test`).

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
  "我": {
    pinyin: "wǒ",
    components: [
      { char: "手", type: "meaning" },
      { char: "戈", type: "sound" },
    ],
  },
};

const emptySets = () => ({ learnedSet: new Set(), wroteSet: new Set() });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

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
  // 新, 年 → both transit chars (neither saved as word)
  assert.equal(cs.length, 2);
  assert.deepEqual(new Set(cs.map((n) => n.data.label)), new Set(["新", "年"]));
  // 新 has 3 components, 年 has none
  assert.equal(comps.length, 3);
  assert.deepEqual(
    new Set(comps.map((n) => n.data.label)),
    new Set(["立", "木", "斤"]),
  );
  assert.equal(g.edges.filter((e) => e.data.kind === "cw").length, 2);
  assert.equal(g.edges.filter((e) => e.data.kind === "pc").length, 3);
});

test("single-char save is a word node, not a char node", () => {
  const g = buildGraph({
    savedWords: ["我"],
    ...emptySets(),
    chars: fixtureChars,
  });
  const words = g.nodes.filter((n) => n.data.kind === "word");
  const cs = g.nodes.filter((n) => n.data.kind === "char");
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.equal(words.length, 1);
  assert.equal(words[0].data.label, "我");
  assert.equal(words[0].data.len, 1);
  assert.equal(words[0].data.tier, "saved");
  // No transit char nodes — there are no multi-char words feeding chars
  assert.equal(cs.length, 0);
  // 我 still has its components
  assert.equal(comps.length, 2);
  assert.deepEqual(new Set(comps.map((n) => n.data.label)), new Set(["手", "戈"]));
  // Components edge directly into the word node
  const pc = g.edges.filter((e) => e.data.kind === "pc");
  assert.equal(pc.length, 2);
  assert.equal(pc.every((e) => e.data.target === "w:我"), true);
});

test("char also saved as a single-char word becomes one word node, no char node", () => {
  // 新 is both inside 新年 and saved on its own — it's only a word node.
  const g = buildGraph({
    savedWords: ["新年", "新"],
    ...emptySets(),
    chars: fixtureChars,
  });
  const words = g.nodes.filter((n) => n.data.kind === "word");
  const cs = g.nodes.filter((n) => n.data.kind === "char");
  // Two words: 新年 + 新
  assert.equal(words.length, 2);
  assert.deepEqual(new Set(words.map((n) => n.data.label)), new Set(["新年", "新"]));
  // Only 年 stays as a transit char (新 escaped to word layer)
  assert.equal(cs.length, 1);
  assert.equal(cs[0].data.label, "年");
  // The membership edge from 新 to 新年 goes word→word
  const edge = g.edges.find((e) => e.data.target === "w:新年" && e.data.source === "w:新");
  assert.ok(edge, "expected w:新 → w:新年 edge");
  // Components feed into the word node for 新, not a phantom char node
  const pc = g.edges.filter((e) => e.data.target === "w:新");
  assert.equal(pc.length, 3);
});

test("component shared with a saved word does not double-render", () => {
  // 木 saved as a word AND it's a component of 新 (via 新年).
  const g = buildGraph({
    savedWords: ["新年", "木"],
    ...emptySets(),
    chars: fixtureChars,
  });
  const words = g.nodes.filter((n) => n.data.kind === "word");
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.deepEqual(new Set(words.map((n) => n.data.label)), new Set(["新年", "木"]));
  // 立 + 斤 stay as components; 木 escaped to word layer
  assert.deepEqual(new Set(comps.map((n) => n.data.label)), new Set(["立", "斤"]));
  // The decomposition edge from 木 to 新 routes word→char (not component→char)
  const woodEdge = g.edges.find((e) => e.data.source === "w:木" && e.data.target === "c:新");
  assert.ok(woodEdge, "expected w:木 → c:新 edge");
});

test("component shared across two chars has one node + two edges", () => {
  const g = buildGraph({
    savedWords: ["学习", "好"],
    ...emptySets(),
    chars: fixtureChars,
  });
  // 子 is a component of both 学 (transit char) and 好 (single-char word)
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  const ziNodes = comps.filter((n) => n.data.label === "子");
  assert.equal(ziNodes.length, 1);
  const ziEdges = g.edges.filter((e) => e.data.source === "p:子");
  assert.equal(ziEdges.length, 2);
  assert.deepEqual(
    new Set(ziEdges.map((e) => e.data.target)),
    new Set(["c:学", "w:好"]),
  );
});

test("learned + wrote tier colors propagate", () => {
  const g = buildGraph({
    savedWords: ["新年", "学习", "好"],
    learnedSet: new Set(["新年", "好"]),
    wroteSet: new Set(["学习"]),
    chars: fixtureChars,
  });
  const tierOf = (label) =>
    g.nodes.find((n) => n.data.kind === "word" && n.data.label === label).data.tier;
  assert.equal(tierOf("新年"), "learned");
  assert.equal(tierOf("学习"), "wrote");
  assert.equal(tierOf("好"), "learned");
});

test("characterless component (◎) is filtered out", () => {
  const g = buildGraph({
    savedWords: ["事"],
    ...emptySets(),
    chars: {
      "事": {
        components: [
          { char: "◎", type: "unknown" },
          { char: "亅", type: "iconic" },
        ],
      },
    },
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
  const cw = g.edges.filter((e) => e.data.kind === "cw");
  assert.equal(cw.length, 1);
  const comps = g.nodes.filter((n) => n.data.kind === "component");
  assert.equal(comps.length, 1);
});

test("duplicate saves de-duplicate to one word node", () => {
  const g = buildGraph({
    savedWords: ["我", "我"],
    ...emptySets(),
    chars: fixtureChars,
  });
  const words = g.nodes.filter((n) => n.data.kind === "word");
  assert.equal(words.length, 1);
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
