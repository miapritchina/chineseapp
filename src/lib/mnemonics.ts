import type { Char } from "./types";

export interface MnemonicEntry {
  text: string;
  // True once the user has edited or replaced the auto-suggested
  // text — used by the encoding-strength heuristic from the science
  // brief (self-generated mnemonics retain better than provided ones).
  edited: boolean;
  updatedAt: number;
}

// Pure helper. Builds a starter sentence for a CHARACTER from its
// role-tagged components. See test-mnemonics.mjs for the contract.
//   清 (氵=water meaning, 青=qing sound) → "氵 (water) + 青 (qing) → 清"
//   林 (木 + 木 iconic)                  → "木 + 木 → 林"
export function buildStarterMnemonic(char: string, cd: Char | undefined): string {
  if (!cd) return char;
  const parts = (cd.components || []).filter((c) => c?.char && c.char !== "◎");
  if (parts.length === 0) {
    const def = cd.definitions?.[0] || "";
    return def ? `${char} = ${def}` : char;
  }
  const piece = (c: { char: string; type?: string; definition?: string; pinyin?: string }) => {
    const tag =
      c.type === "sound"
        ? c.pinyin || ""
        : c.definition || "";
    return tag ? `${c.char} (${tag})` : c.char;
  };
  return parts.map(piece).join(" + ") + ` → ${char}`;
}

// Build a starter for a WORD by chaining its characters' pinyin + first
// definition. Cheap heuristic — readable, often good enough on its own
// for two-char compounds.
//   新年 (xīn nián, new + year) → "新 (xīn, new) + 年 (nián, year) → 新年 (new year)"
export function buildStarterWordMnemonic(
  word: string,
  pinyin: string,
  wholeMeaning: string,
  chars: Record<string, Char>,
): string {
  if (!word) return "";
  const cells = [...word];
  if (cells.length < 2) {
    // Single-char path lives in buildStarterMnemonic; falling back to
    // the bare word here keeps the API symmetric.
    return word;
  }
  const pieces = cells.map((c) => {
    const cd = chars[c];
    const py = cd?.pinyin || "";
    const def = cd?.definitions?.[0] || "";
    if (py && def) return `${c} (${py}, ${def})`;
    if (py) return `${c} (${py})`;
    if (def) return `${c} (${def})`;
    return c;
  });
  const head = pieces.join(" + ") + ` → ${word}`;
  return wholeMeaning ? `${head} (${wholeMeaning})` : head;
}
