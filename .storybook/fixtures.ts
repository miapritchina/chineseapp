// Static fixture data for stories — a tiny slice of the real data shapes
// so context-resolving components (Entity, drill cards) render without
// Supabase or data-chars.json.

import type { Char, Word } from "../src/lib/types";

const word = (w: string, pinyin: string, defs: string[], rest?: Partial<Word>): Word => ({
  word: w,
  pinyin,
  searchablePinyin: pinyin.toLowerCase(),
  definitions: defs,
  hsk: 1,
  rank: 100,
  simp: w,
  chars: [...w],
  ...rest,
});

export const WORDS: Record<string, Word> = {
  你好: word("你好", "nǐ hǎo", ["hello", "hi"]),
  请: word("请", "qǐng", ["please", "to invite"]),
  中国: word("中国", "zhōng guó", ["China"]),
  发展中国家: word("发展中国家", "fā zhǎn zhōng guó jiā", ["developing country"]),
};

export const CHARS: Record<string, Char> = {
  请: {
    char: "请",
    pinyin: "qǐng",
    definitions: ["please", "to invite"],
    originalMeaning: "to request",
    notes: "",
    hasEtymology: true,
    components: [
      { char: "讠", type: "meaning", pinyin: "yán", definition: "speech", hint: "", fragment: [0, 2] },
      { char: "青", type: "sound", pinyin: "qīng", definition: "green/blue", hint: "", fragment: [2] },
    ],
  },
  你: {
    char: "你",
    pinyin: "nǐ",
    definitions: ["you"],
    originalMeaning: "",
    notes: "",
    hasEtymology: true,
    components: [
      { char: "亻", type: "meaning", pinyin: "rén", definition: "person", hint: "", fragment: [0, 2] },
      { char: "尔", type: "sound", pinyin: "ěr", definition: "you (archaic)", hint: "", fragment: [2] },
    ],
  },
  好: {
    char: "好",
    pinyin: "hǎo",
    definitions: ["good"],
    originalMeaning: "",
    notes: "",
    hasEtymology: true,
    components: [
      { char: "女", type: "meaning", pinyin: "nǚ", definition: "woman", hint: "", fragment: [0, 3] },
      { char: "子", type: "meaning", pinyin: "zǐ", definition: "child", hint: "", fragment: [3] },
    ],
  },
};

export const providerProps = {
  saved: {
    saved: new Set<string>(["你好", "请", "中国"]),
    savedList: [
      { word: "你好", savedAt: 1 },
      { word: "请", savedAt: 2 },
      { word: "中国", savedAt: 3 },
    ],
    learned: new Set<string>(["中国"]),
    wrote: new Set<string>(),
    review: new Set<string>(),
    getStatus: (key: string) => (key === "中国" ? ("learned" as const) : ("saved" as const)),
    setStatus: () => {},
  },
  dict: {
    findWord: (k: string) => WORDS[k] ?? null,
    ensureCached: async () => {},
    search: async () => Object.values(WORDS),
    error: null,
  },
  chars: { chars: CHARS, ready: true },
  mnemonics: { get: () => null, save: () => {}, clear: () => {} },
  auth: {
    user: null,
    loading: false,
    signInWithEmail: async () => ({ error: null }),
    signOut: async () => {},
  },
};
