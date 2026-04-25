import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const lex = require("chinese-lexicon");

const __dirname = dirname(fileURLToPath(import.meta.url));
const wordsPath = resolve(__dirname, "..", "chinese", "data.json");
const charsPath = resolve(__dirname, "..", "chinese", "data-chars.json");

const MAX_WORD_LEN = 8;

// Hand-picked beginner-friendly shelf shown above the full list on the home screen.
const SUGGESTED_SHELF = [
  "你好", "我", "是", "好", "想", "学", "吃", "家", "喝", "茶", "水", "猫", "狗",
  "妈妈", "爸爸", "朋友", "老师", "学生", "学校", "中国", "美国", "今天", "明天",
  "爱", "笑", "看", "听", "说", "走", "跑",
];

const HANZI_RE = /^[㐀-鿿豈-﫿]+$/;

function isProperNoun(entry) {
  return /^[A-Z]/.test(entry.pinyin || "");
}

function isOnlyCrossRef(entry) {
  const defs = entry.definitions || [];
  if (defs.length === 0) return true;
  return defs.every((d) => /^see /i.test(d) || /^variant of /i.test(d));
}

function bestEntry(entries, preferredSimp) {
  if (!entries || entries.length === 0) return null;
  if (preferredSimp) {
    const match = entries.find((e) => e.simp === preferredSimp);
    if (match) return match;
  }
  return entries.reduce((a, b) => ((a.boost ?? 0) >= (b.boost ?? 0) ? a : b));
}

function cleanDefinitions(defs) {
  if (!Array.isArray(defs)) return [];
  return defs.filter((d) => !/^CL:/.test(d));
}

// Ship every chinese-lexicon entry whose simp looks like a real word (CJK only,
// length ≤ MAX_WORD_LEN, not a proper noun, not just a cross-reference).
// Sort by movieWordRank ascending; entries without a rank go to the end in
// stable simp order.
function buildAllEntries() {
  const filtered = [];
  for (const e of lex.allEntries) {
    if (!HANZI_RE.test(e.simp)) continue;
    if (e.simp.length > MAX_WORD_LEN) continue;
    if (isProperNoun(e)) continue;
    if (isOnlyCrossRef(e)) continue;
    filtered.push(e);
  }
  filtered.sort((a, b) => {
    const ar = a.statistics?.movieWordRank ?? Infinity;
    const br = b.statistics?.movieWordRank ?? Infinity;
    if (ar !== br) return ar - br;
    return a.simp.localeCompare(b.simp);
  });
  const seen = new Set();
  const out = [];
  for (const e of filtered) {
    if (seen.has(e.simp)) continue;
    seen.add(e.simp);
    out.push(e);
  }
  return out;
}

function normalizeChar(char) {
  const entries = lex.getEntries(char) || [];
  const topEntry = bestEntry(entries, char);
  const etym = lex.getEtymology(char);

  const pinyin =
    topEntry?.pinyin?.replace(/​/g, "") || etym?.pinyin || "";
  const definitions = cleanDefinitions(topEntry?.definitions);
  const originalMeaning = etym?.definition || "";
  const notes = etym?.notes || "";

  const components = Array.isArray(etym?.components)
    ? etym.components.map((c) => ({
        char: c.char,
        type: c.type || "unknown",
        pinyin: (c.pinyin || "").replace(/​/g, ""),
        definition: c.definition || "",
        hint: (c.notes || "").trim(),
        fragment: Array.isArray(c.fragment) ? c.fragment : null,
      }))
    : [];

  return {
    char,
    pinyin,
    definitions,
    originalMeaning,
    notes: notes.trim(),
    components,
    hasEtymology: !!etym,
  };
}

function splitChars(str) {
  return Array.from(str);
}

function main() {
  const allEntries = buildAllEntries();
  console.log(`Filtered entries (full lexicon): ${allEntries.length}`);

  const words = [];
  const charsMap = new Map();
  const queue = [];
  const seen = new Set();

  for (const entry of allEntries) {
    const word = entry.simp;
    const chars = splitChars(word);

    // Trim per-word JSON: drop fields the runtime can derive (simp == word,
    // chars == [...word]) or doesn't use (trad). The savings dominate at
    // 90k+ entries.
    const trad = entry.trad !== entry.simp ? entry.trad : undefined;
    words.push({
      word,
      ...(trad ? { trad } : {}),
      pinyin: (entry.pinyin || "").replace(/​/g, ""),
      searchablePinyin: (entry.searchablePinyin || "").replace(/\s+/g, ""),
      definitions: cleanDefinitions(entry.definitions),
      hsk: entry.statistics?.hskLevel ?? null,
      rank: entry.statistics?.movieWordRank ?? null,
    });

    for (const ch of chars) {
      if (!seen.has(ch)) {
        seen.add(ch);
        queue.push(ch);
      }
    }
  }

  while (queue.length) {
    const ch = queue.shift();
    const entry = normalizeChar(ch);
    charsMap.set(ch, entry);
    for (const c of entry.components) {
      if (!seen.has(c.char)) {
        seen.add(c.char);
        queue.push(c.char);
      }
    }
  }

  // appearsIn is computed client-side from `words` at boot — no need to
  // pre-bake it into the JSON, especially for the full lexicon where common
  // chars (e.g. 的) appear in tens of thousands of words.
  const chars = {};
  for (const [ch, entry] of charsMap) {
    chars[ch] = entry;
  }

  // Split into two files so the home/search can render as soon as the smaller
  // words file arrives; chars are loaded in parallel and awaited only when a
  // modal/popup actually needs them.
  const wordsData = {
    generated: new Date().toISOString(),
    source: "chinese-lexicon v" + require("chinese-lexicon/package.json").version,
    suggested: SUGGESTED_SHELF.filter((w) => words.some((x) => x.word === w)),
    words,
  };
  const charsData = { chars };

  writeFileSync(wordsPath, JSON.stringify(wordsData) + "\n");
  writeFileSync(charsPath, JSON.stringify(charsData) + "\n");
  console.log(`Wrote ${wordsPath} and ${charsPath}`);
  console.log(`  ${words.length} words, ${Object.keys(chars).length} unique chars`);
  const noEtym = Object.values(chars).filter((c) => !c.hasEtymology).length;
  console.log(`  chars without etymology: ${noEtym}`);
  const noFrag = Object.values(chars).filter(
    (c) => c.hasEtymology && c.components.length > 0 && c.components.every((co) => !co.fragment)
  ).length;
  console.log(`  chars with components but no fragment ranges: ${noFrag}`);
}

main();
