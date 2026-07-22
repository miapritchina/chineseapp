import { describe, expect, it } from "vitest";
import {
  buildComponentIndex,
  charToSavedWords,
  savedConnections,
  wordsSharingChar,
  wordsUsing,
} from "./explore";
import type { Char } from "./types";

const comp = (char: string) => ({ char, type: "sound", pinyin: "", definition: "", hint: "" });
const CHARS = {
  请: { components: [comp("讠"), comp("青")] },
  情: { components: [comp("忄"), comp("青")] },
  好: { components: [comp("女"), comp("子")] },
  青: { components: [] },
} as unknown as Record<string, Char>;

describe("buildComponentIndex", () => {
  it("maps a component to every character built with it", () => {
    const idx = buildComponentIndex(CHARS);
    expect(idx.get("青")?.sort()).toEqual(["情", "请"]);
    expect(idx.get("女")).toEqual(["好"]);
    expect(idx.get("请")).toBeUndefined();
  });
});

describe("charToSavedWords", () => {
  it("maps each distinct char to the saved words using it", () => {
    const m = charToSavedWords(["你好", "好人", "人人"]);
    expect(m.get("好")).toEqual(["你好", "好人"]);
    expect(m.get("人")).toEqual(["好人", "人人"]); // 人人 counted once
  });
});

describe("savedConnections", () => {
  const m = charToSavedWords(["你好", "好人", "中国"]);
  it("char badge = my words using it", () => {
    expect(savedConnections("好", "char", m)).toBe(2);
    expect(savedConnections("国", "component", m)).toBe(1);
    expect(savedConnections("青", "char", m)).toBe(0); // dead end
  });
  it("word badge = my other words sharing a character", () => {
    expect(savedConnections("你好", "word", m)).toBe(1); // 好人
    expect(savedConnections("中国", "word", m)).toBe(0);
  });
  it("component badge counts words connected through built-with chars", () => {
    const saved = charToSavedWords(["请假", "事情"]);
    const idx = buildComponentIndex(CHARS); // 青 → 请, 情
    expect(savedConnections("青", "component", saved, idx)).toBe(2);
  });
});

describe("wordsUsing", () => {
  it("lists direct hits first, then words via built-with chars, deduped", () => {
    const saved = charToSavedWords(["青天", "请假", "事情"]);
    const idx = buildComponentIndex(CHARS);
    expect(wordsUsing("青", saved, idx)).toEqual(["青天", "请假", "事情"]);
  });
});

describe("wordsSharingChar", () => {
  it("lists other saved words sharing any character, preserving order", () => {
    expect(wordsSharingChar("你好", ["你好", "好人", "中国", "你们"])).toEqual(["好人", "你们"]);
  });
});
