// Probe chinese-lexicon to map every field's value distribution.
// Run with `node scripts/probe-lexicon.mjs`.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const lex = require("chinese-lexicon");

const { allEntries } = lex;
const etyms = require("chinese-lexicon/etymology/index.js").etymologies;

function countKeys(objs, sample = 2000) {
  const counts = new Map();
  let i = 0;
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    for (const k of Object.keys(o)) counts.set(k, (counts.get(k) || 0) + 1);
    if (++i >= sample) break;
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function tally(values, top = 20) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}

const log = (label, x) => {
  console.log("\n=== " + label + " ===");
  console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));
};

// --- Word entry shape ---
log("entry keys (frequency over first 2000)", countKeys(allEntries));

const sample = allEntries.find((e) => e.simp === "好");
log("sample 'good' entry", sample);

// --- Pinyin shape ---
log("pinyin: contains semicolons (multi-pron)?",
  allEntries.filter((e) => /;/.test(e.pinyin || "")).length + " / " + allEntries.length,
);
log("searchablePinyin: lowercase only?",
  allEntries.filter((e) => e.searchablePinyin && /[A-Z]/.test(e.searchablePinyin)).length + " entries with uppercase",
);
log("pinyinTones presence",
  allEntries.filter((e) => e.pinyinTones).length + " / " + allEntries.length,
);

// --- definitions ---
const defLengths = allEntries.map((e) => (e.definitions || []).length);
log("definitions array length distribution",
  Object.fromEntries(
    Object.entries(
      defLengths.reduce((acc, n) => ((acc[n] = (acc[n] || 0) + 1), acc), {}),
    ).sort((a, b) => +a[0] - +b[0]),
  ),
);
log("max definitions count: " + Math.max(...defLengths) + " (sample with that count)",
  allEntries.find((e) => (e.definitions || []).length === Math.max(...defLengths))?.simp,
);

// Cross-ref definitions
const seeRefs = allEntries.filter((e) =>
  (e.definitions || []).some((d) => /^see /i.test(d)),
).length;
const variantOf = allEntries.filter((e) =>
  (e.definitions || []).some((d) => /^variant of /i.test(d)),
).length;
const clMarkers = allEntries.filter((e) => (e.definitions || []).some((d) => /^CL:/.test(d))).length;
log("definition flavors",
  { "starts with 'see ...'": seeRefs, "variant of ...": variantOf, "has 'CL:' marker": clMarkers },
);

// --- Etymology types ---
const allEtymVals = Object.values(etyms);
log("etymology entries (sample first 1)", allEtymVals[0]);
log("etymology keys", countKeys(allEtymVals));

const componentTypes = [];
const fragmentLengths = [];
const fragmentValues = []; // first few examples per length
for (const e of allEtymVals) {
  for (const c of e.components || []) {
    componentTypes.push(c.type);
    if (Array.isArray(c.fragment)) {
      fragmentLengths.push(c.fragment.length);
      fragmentValues.push({ char: c.char, fragment: c.fragment, type: c.type });
    }
  }
}
log("component types", tally(componentTypes));
log("fragment array lengths", tally(fragmentLengths));

// First 5 examples per length
const byLen = new Map();
for (const x of fragmentValues) {
  if (!byLen.has(x.fragment.length)) byLen.set(x.fragment.length, []);
  if (byLen.get(x.fragment.length).length < 4) byLen.get(x.fragment.length).push(x);
}
log("fragment examples by length", [...byLen.entries()].sort((a, b) => a[0] - b[0]));

// Fragment containing 0?
log(
  "fragments not starting at 0 (top 8)",
  fragmentValues.filter((x) => x.fragment[0] !== 0).slice(0, 8),
);

// --- Component characters ---
const compChars = new Map();
for (const e of allEtymVals) for (const c of e.components || []) compChars.set(c.char, (compChars.get(c.char) || 0) + 1);
const compCharsSorted = [...compChars.entries()].sort((a, b) => b[1] - a[1]);
log("most common component chars (top 15)", compCharsSorted.slice(0, 15));
log("characterless ◎ component appearances", compChars.get("◎") || 0);
const nonHanComps = [...compChars.keys()].filter((c) => /[A-Za-z]/.test(c));
log("component chars containing latin letters?", nonHanComps);

// --- pinyin "xx" placeholder ---
let xxCount = 0;
for (const e of allEtymVals) for (const c of e.components || []) if (c.pinyin === "xx") xxCount++;
log("components with pinyin === 'xx'", xxCount);

// --- statistics ---
const stats = allEntries.find((e) => e.statistics)?.statistics;
log("statistics keys (sample)", stats ? Object.keys(stats) : []);
log(
  "hskLevel distribution",
  tally(allEntries.map((e) => e.statistics?.hskLevel ?? "(none)").map(String), 15),
);

// topWords
const sampleWithTop = allEntries.find((e) => e.statistics?.topWords?.length > 5);
log("topWords sample (first 3 of one entry)", {
  word: sampleWithTop?.simp,
  topWords: sampleWithTop?.statistics?.topWords?.slice(0, 3),
});

// --- images ---
const withImages = allEtymVals.filter((e) => e.images?.length > 0);
log("etymology entries with images", withImages.length + " / " + allEtymVals.length);
log("image captions (top 10)",
  tally(withImages.flatMap((e) => e.images.map((i) => i.caption))),
);

// --- notes length ---
const noteLengths = allEtymVals.map((e) => (e.notes || "").length);
log("etymology notes length stats",
  {
    n: noteLengths.length,
    min: Math.min(...noteLengths),
    max: Math.max(...noteLengths),
    avg: (noteLengths.reduce((a, b) => a + b, 0) / noteLengths.length).toFixed(0),
    p50: noteLengths.sort((a, b) => a - b)[Math.floor(noteLengths.length / 2)],
    p95: noteLengths.sort((a, b) => a - b)[Math.floor(noteLengths.length * 0.95)],
  },
);
