import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const lex = require("chinese-lexicon");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "..", "chinese", "data.json");

const SEED_SIZE = 8000;

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

function buildSeedFromRank() {
  const ranked = lex.allEntries
    .filter((e) => {
      if (!e.statistics) return false;
      if (e.statistics.movieWordRank == null) return false;
      if (!HANZI_RE.test(e.simp)) return false;
      if (e.simp.length > 4) return false;
      if (isProperNoun(e)) return false;
      if (isOnlyCrossRef(e)) return false;
      return true;
    })
    .sort((a, b) => a.statistics.movieWordRank - b.statistics.movieWordRank);

  const seen = new Set();
  const seed = [];
  for (const e of ranked) {
    if (seen.has(e.simp)) continue;
    seen.add(e.simp);
    seed.push(e);
    if (seed.length >= SEED_SIZE) break;
  }
  return seed;
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
    definitions: definitions.slice(0, 4),
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
  const seedEntries = buildSeedFromRank();
  console.log(`Seed: top ${seedEntries.length} entries by movieWordRank`);

  const words = [];
  const charsMap = new Map();
  const queue = [];
  const seen = new Set();

  for (const entry of seedEntries) {
    const word = entry.simp;
    const chars = splitChars(word);

    words.push({
      word,
      simp: entry.simp,
      trad: entry.trad,
      pinyin: (entry.pinyin || "").replace(/​/g, ""),
      searchablePinyin: (entry.searchablePinyin || "").replace(/\s+/g, ""),
      definitions: cleanDefinitions(entry.definitions).slice(0, 4),
      hsk: entry.statistics?.hskLevel ?? null,
      rank: entry.statistics?.movieWordRank ?? null,
      chars,
    });

    for (const ch of chars) {
      if (!seen.has(ch)) {
        seen.add(ch);
        queue.push(ch);
      }
    }
  }

  // Also pull suggested-shelf words even if they fell outside the rank cutoff.
  for (const word of SUGGESTED_SHELF) {
    if (words.some((w) => w.word === word)) continue;
    const entries = lex.getEntries(word) || [];
    const entry = bestEntry(entries, word);
    if (!entry) continue;
    words.push({
      word,
      simp: entry.simp,
      trad: entry.trad,
      pinyin: (entry.pinyin || "").replace(/​/g, ""),
      searchablePinyin: (entry.searchablePinyin || "").replace(/\s+/g, ""),
      definitions: cleanDefinitions(entry.definitions).slice(0, 4),
      hsk: entry.statistics?.hskLevel ?? null,
      rank: entry.statistics?.movieWordRank ?? null,
      chars: splitChars(word),
    });
    for (const ch of splitChars(word)) {
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

  const appearsIn = new Map();
  for (const w of words) {
    const touched = new Set();
    for (const ch of w.chars) {
      touched.add(ch);
      const entry = charsMap.get(ch);
      if (entry) {
        for (const c of entry.components) {
          touched.add(c.char);
          const nested = charsMap.get(c.char);
          if (nested) for (const cc of nested.components) touched.add(cc.char);
        }
      }
    }
    for (const ch of touched) {
      if (!appearsIn.has(ch)) appearsIn.set(ch, new Set());
      appearsIn.get(ch).add(w.word);
    }
  }

  // Cap appearsIn at 40 — common chars like 的 appear in thousands of words and
  // dump a huge list; the UI never shows more than 30 chips anyway.
  const chars = {};
  for (const [ch, entry] of charsMap) {
    chars[ch] = {
      ...entry,
      appearsIn: Array.from(appearsIn.get(ch) || []).slice(0, 40),
    };
  }

  const data = {
    generated: new Date().toISOString(),
    source: "chinese-lexicon v" + require("chinese-lexicon/package.json").version,
    suggested: SUGGESTED_SHELF.filter((w) => words.some((x) => x.word === w)),
    words,
    chars,
  };

  writeFileSync(outPath, JSON.stringify(data) + "\n");
  console.log(`Wrote ${outPath}`);
  console.log(`  ${words.length} words, ${Object.keys(chars).length} unique chars`);
  const noEtym = Object.values(chars).filter((c) => !c.hasEtymology).length;
  console.log(`  chars without etymology: ${noEtym}`);
  const noFrag = Object.values(chars).filter(
    (c) => c.hasEtymology && c.components.length > 0 && c.components.every((co) => !co.fragment)
  ).length;
  console.log(`  chars with components but no fragment ranges: ${noFrag}`);
}

main();
