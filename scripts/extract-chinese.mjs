import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const lex = require("chinese-lexicon");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "..", "chinese", "data.json");

const SEED_WORDS = [
  "叫", "对", "你", "好", "我", "老师", "学生", "水", "瓶", "一", "咖啡",
  "杯", "牛", "奶", "三", "要", "五", "四", "面包", "八", "九", "十", "七", "六",
  "说话", "文", "天", "丈", "大", "日", "本", "国", "英", "韩",
  "公司", "班", "学院", "都", "大学", "中学", "小学", "工人",
  "茶", "不", "有", "没有", "爱", "喝",
  "儿子", "女", "孩子", "猫", "狗",
  "妹妹", "哥哥", "弟弟", "妈妈", "爸爸", "爷爷", "奶奶", "姐姐", "叔叔", "阿姨",
  "哪", "那", "这个", "哪里", "那里",
  "外边", "里边", "后边", "前边",
  "商场", "电影院", "餐厅", "医院", "洗手间",
  "网友", "朋友", "人", "女人", "男人", "同学", "宿舍",
  "面条", "米饭", "寿司", "饺子", "包子", "馄饨", "油条", "坚果",
  "币", "铜币", "纸币", "两", "汤", "活", "多少", "一百", "二十",
  "英文", "韩文",
];

function bestEntry(entries, preferredSimp) {
  if (!entries || entries.length === 0) return null;
  if (preferredSimp) {
    const match = entries.find((e) => e.simp === preferredSimp);
    if (match) return match;
  }
  // Highest boost wins by default
  return entries.reduce((a, b) => ((a.boost ?? 0) >= (b.boost ?? 0) ? a : b));
}

function cleanDefinitions(defs) {
  if (!Array.isArray(defs)) return [];
  // Strip the CL: cross-references to keep the UI tidy
  return defs.filter((d) => !/^CL:/.test(d));
}

function normalizeChar(char) {
  const entries = lex.getEntries(char) || [];
  const topEntry = bestEntry(entries, char);
  const etym = lex.getEtymology(char);

  const pinyin =
    topEntry?.pinyin?.replace(/​/g, "") ||
    etym?.pinyin ||
    "";
  const definitions = cleanDefinitions(topEntry?.definitions);
  const originalMeaning = etym?.definition || "";
  const notes = etym?.notes || "";

  const components = Array.isArray(etym?.components)
    ? etym.components.map((c) => ({
        char: c.char,
        type: c.type || "unknown",
        pinyin: c.pinyin || "",
        definition: c.definition || "",
        hint: (c.notes || "").trim(),
      }))
    : [];

  // Images come as CSS url("...") strings; unwrap to a plain data: URL.
  const images = Array.isArray(etym?.images)
    ? etym.images
        .map((img) => {
          const raw = typeof img.url === "string" ? img.url : "";
          const m = /^url\((?:"|')?(.*?)(?:"|')?\)$/s.exec(raw.trim());
          const url = m ? m[1] : raw;
          return { url, caption: img.caption || "" };
        })
        .filter((i) => i.url)
    : [];

  return {
    char,
    pinyin,
    definitions,
    originalMeaning,
    notes: notes.trim(),
    components,
    images,
    hasEtymology: !!etym,
  };
}

function splitChars(str) {
  return Array.from(str);
}

function main() {
  const words = [];
  const charsMap = new Map();
  const queue = [];
  const seen = new Set();

  for (const word of SEED_WORDS) {
    const entries = lex.getEntries(word) || [];
    const entry = bestEntry(entries, word);
    const chars = splitChars(word);

    words.push({
      word,
      simp: entry?.simp || word,
      trad: entry?.trad || word,
      pinyin: (entry?.pinyin || "").replace(/​/g, ""),
      definitions: cleanDefinitions(entry?.definitions),
      chars,
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

  // Build "also appears in" — which seed words reference this char
  // either as a character of the word, or as a component of any of that word's chars.
  const appearsIn = new Map(); // char -> Set<wordString>
  for (const w of words) {
    const touched = new Set();
    for (const ch of w.chars) {
      touched.add(ch);
      const entry = charsMap.get(ch);
      if (entry) {
        for (const c of entry.components) {
          touched.add(c.char);
          // Also include component's components (one more level) so 口 in 咖 shows 叫 too
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

  const chars = {};
  for (const [ch, entry] of charsMap) {
    chars[ch] = {
      ...entry,
      appearsIn: Array.from(appearsIn.get(ch) || []),
    };
  }

  const data = {
    generated: new Date().toISOString(),
    source: "chinese-lexicon v" + require("chinese-lexicon/package.json").version,
    words,
    chars,
  };

  writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
  console.log(`  ${words.length} words, ${Object.keys(chars).length} unique chars`);
  const noEtym = Object.values(chars).filter((c) => !c.hasEtymology).map((c) => c.char);
  if (noEtym.length) console.log(`  chars without etymology: ${noEtym.join(" ")}`);
}

main();
