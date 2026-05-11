// Strip combining tone marks + spaces → ASCII lowercase, so "laoshi"
// matches "lǎo shī".
export function normalizePinyin(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// Combining diacritic codepoint → Mandarin tone number. 0 = neutral.
const TONE_MARK: Record<number, number> = {
  0x0304: 1, // macron  ◌̄  → 1st tone
  0x0301: 2, // acute   ◌́  → 2nd tone
  0x030c: 3, // caron   ◌̌  → 3rd tone
  0x0300: 4, // grave   ◌̀  → 4th tone
};

// Per-syllable tone numbers as a space-joined string. Best-effort:
// splits on whitespace (our pinyin is space-separated), reads the first
// combining mark in each syllable, falls back to 0 when unmarked.
//   "xīn nián"  → "1 2"
//   "shàng hǎi" → "4 3"
//   "ma ma"     → "0 0"
export function tonePattern(pinyin: string): string {
  if (!pinyin) return "";
  const syllables = pinyin.normalize("NFD").split(/\s+/).filter(Boolean);
  if (syllables.length === 0) return "";
  return syllables
    .map((s) => {
      for (const ch of s) {
        const t = TONE_MARK[ch.charCodeAt(0)];
        if (t) return String(t);
      }
      return "0";
    })
    .join(" ");
}

// "TONE 3" / "TONES 4 3" / "" — a short label for a sheet header.
export function toneLabel(pinyin: string): string {
  const p = tonePattern(pinyin);
  if (!p) return "";
  const parts = p.split(" ");
  return parts.length === 1 ? `TONE ${parts[0]}` : `TONES ${p}`;
}

export const HAN_RE = /[㐀-鿿豈-﫿]/;
