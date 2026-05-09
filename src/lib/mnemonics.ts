import type { Char } from "./types";

const KEY = "chinese.mnemonics.v1";

export interface MnemonicEntry {
  text: string;
  // True once the user has edited or replaced the auto-suggested
  // text — used by the encoding-strength heuristic from the science
  // brief (self-generated mnemonics retain better than provided ones).
  edited: boolean;
  updatedAt: number;
}

// Build a starter sentence for a character from its role-tagged
// components. Pure function over the data — no IO.
//
// Examples:
//   清 (氵=water meaning, 青=qing sound) → "氵 (water) + 青 (qing) → 清"
//   林 (木 + 木 iconic)                  → "木 + 木 → 林"
//
// Edge cases: characters without components (or with only a single
// characterless ◎ stub) get a single-line stub the user can replace.
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

function loadAll(): Record<string, MnemonicEntry> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, MnemonicEntry>;
  } catch {
    /* ignore */
  }
  return {};
}

function persistAll(map: Record<string, MnemonicEntry>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota */
  }
}

export function loadMnemonic(char: string): MnemonicEntry | null {
  return loadAll()[char] ?? null;
}

export function saveMnemonic(char: string, text: string): MnemonicEntry {
  const all = loadAll();
  const prev = all[char];
  const entry: MnemonicEntry = {
    text,
    edited: true,
    updatedAt: Date.now(),
  };
  all[char] = entry;
  persistAll(all);
  return entry;
}

export function clearMnemonic(char: string) {
  const all = loadAll();
  if (!all[char]) return;
  delete all[char];
  persistAll(all);
}
