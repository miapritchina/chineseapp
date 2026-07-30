import { describe, expect, it } from "vitest";
import { buildForgeRound, forgeCandidates, forgeMatch } from "./forge";
import type { Char } from "./types";

const cd = (char: string, pieces: string[]): Char =>
  ({
    char,
    pinyin: "x",
    definitions: [],
    originalMeaning: "",
    notes: "",
    hasEtymology: true,
    components: pieces.map((p) => ({ char: p, type: "meaning" })),
  }) as unknown as Char;

const chars: Record<string, Char> = {
  请: cd("请", ["讠", "青"]),
  情: cd("情", ["忄", "青"]),
  好: cd("好", ["女", "子"]),
  明: cd("明", ["日", "月"]),
  林: cd("林", ["木", "木"]),
  中: cd("中", []),
};

describe("forgeCandidates", () => {
  it("keeps only 2-distinct-piece characters from saved words", () => {
    const c = forgeCandidates(["请中", "好", "林", "明"], chars);
    expect(c.map((t) => t.char)).toEqual(["请", "好", "明"]);
  });
});

describe("buildForgeRound", () => {
  it("never repeats a piece glyph across the round", () => {
    const round = buildForgeRound(forgeCandidates(["请", "情", "好", "明"], chars), () => 0, 5);
    // 请 and 情 share 青 — only one of them can be in the round.
    expect(round).not.toBeNull();
    expect(new Set(round!.pieces).size).toBe(round!.pieces.length);
    expect(round!.targets.length).toBe(3);
  });
  it("null below 3 targets", () => {
    expect(buildForgeRound(forgeCandidates(["请", "好"], chars), () => 0)).toBeNull();
  });
});

describe("forgeMatch", () => {
  const targets = [
    { char: "好", pieces: ["女", "子"] as [string, string] },
    { char: "明", pieces: ["日", "月"] as [string, string] },
  ];
  it("matches either tap order, skips already-forged", () => {
    expect(forgeMatch(targets, new Set(), "子", "女")?.char).toBe("好");
    expect(forgeMatch(targets, new Set(["好"]), "女", "子")).toBeNull();
    expect(forgeMatch(targets, new Set(), "女", "月")).toBeNull();
  });
});
