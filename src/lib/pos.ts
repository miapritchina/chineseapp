// Simple part-of-speech detection for the Sentence Studio (E2). The
// project's dictionary (chinese-lexicon → Supabase `words` table) doesn't
// carry POS tags, so we infer from the first English gloss with a small
// hand-curated lookup for closed-class words (pronouns, particles,
// common adverbs / adjectives).
//
// Heuristic is intentionally lightweight — close enough for the tab
// filter UX; if it picks wrong, the user still sees the word under
// "All" and can use it anyway.

import type { Word } from "./types";

export type Pos = "pron" | "v" | "n" | "adj" | "adv" | "part" | "conj";

export const POS_LABEL: Record<Pos, string> = {
  pron: "pronoun",
  v: "verb",
  n: "noun",
  adj: "adj",
  adv: "adv",
  part: "particle",
  conj: "conj",
};

// POS hues lifted from the handoff (matches the original wireframe palette).
export const POS_COLOR: Record<Pos, string> = {
  pron: "#6b3a8a",
  v: "#b14430",
  n: "#2f5a8e",
  adj: "#4f7d3a",
  adv: "#8a6a26",
  part: "#8a8273",
  conj: "#7a6a8a",
};

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

// Tiny glossary of common adverbs + adjectives keyed by their primary
// English gloss. Used as a tiebreaker when the def-prefix heuristic
// doesn't fire.
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

function defOf(word: Word): string {
  return (word.definitions?.[0] || "").trim().toLowerCase();
}

export function detectPos(word: Word): Pos {
  const w = word.word;
  if (PRONOUNS.has(w)) return "pron";
  if (PARTICLES.has(w)) return "part";
  if (CONJUNCTIONS.has(w)) return "conj";

  const d = defOf(word);
  // Common gloss patterns the dictionary uses for verbs / particles.
  if (/^to /.test(d) || /^to\b/.test(d)) return "v";
  if (/\bparticle\b/.test(d) || /\baspect\b/.test(d) || /^\(question/.test(d)) return "part";
  if (ADVERB_GLOSSES.has(d)) return "adv";
  if (ADJECTIVE_GLOSSES.has(d)) return "adj";
  return "n";
}
