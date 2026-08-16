// Hanzi display fonts (v133). Five owner-supplied faces, subsetted to
// the app's ~10k-character set and self-hosted in public/fonts/ as
// woff2 (1–3 MB each; loaded only when selected, SW-cached after).
// --font-hanzi is the one CSS hook: every big-glyph class references
// it with a fallback, so setting the var on <html> restyles the whole
// app and setting it on a drill container restyles one card.

export interface HanziFont {
  id: string;
  // Menu label.
  label: string;
  // The @font-face family (undefined = no webfont, system rendering).
  family?: string;
  file?: string;
  // Full CSS stack for --font-hanzi (undefined = unset the var).
  stack?: string;
}

export const HANZI_FONTS: HanziFont[] = [
  { id: "system", label: "System" },
  {
    id: "kai",
    label: "Kai · 楷体",
    family: "FZKai",
    file: "fzkai.woff2",
    // Native Kaiti first where Safari can see it (macOS); the webfont
    // covers iOS, where Kaiti is document-support only.
    stack: '"Kaiti SC", "Kaiti TC", STKaiti, KaiTi, "FZKai", serif',
  },
  {
    id: "fangsong",
    label: "FangSong · 仿宋",
    family: "FZFangSong",
    file: "fzfangsong.woff2",
    stack: '"FZFangSong", "FangSong", STFangsong, serif',
  },
  {
    id: "ming",
    label: "Ming · 明體",
    family: "CwTeXMing",
    file: "cwtexming.woff2",
    stack: '"CwTeXMing", serif',
  },
  {
    id: "jixiangsong",
    label: "JiXiang Song · 吉祥宋",
    family: "JiXiangSong",
    file: "jixiangsong.woff2",
    stack: '"JiXiangSong", serif',
  },
  {
    id: "weibei",
    label: "WeiBei · 魏碑",
    family: "HanWangWeBe",
    file: "hanwangwebe.woff2",
    stack: '"HanWangWeBe", serif',
  },
];

export function fontById(id: string): HanziFont {
  return HANZI_FONTS.find((f) => f.id === id) ?? HANZI_FONTS[0];
}

export function nextFontId(id: string): string {
  const i = HANZI_FONTS.findIndex((f) => f.id === id);
  return HANZI_FONTS[(i + 1) % HANZI_FONTS.length].id;
}

// Inject one font's @font-face (idempotent). base = import.meta.env.BASE_URL.
export function ensureFontFace(font: HanziFont, base: string) {
  if (!font.family || !font.file) return;
  const styleId = `hanzi-font-${font.id}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `@font-face { font-family: "${font.family}"; src: url("${base}fonts/${font.file}") format("woff2"); font-display: swap; }`;
  document.head.appendChild(style);
}

export function ensureAllFontFaces(base: string) {
  for (const f of HANZI_FONTS) ensureFontFace(f, base);
}

// Deterministic per-card font for the random-drill mode: same card →
// same font within a session (no flicker on re-render), different
// cards spread across all faces incl. system. The three
// traditional-leaning faces miss ~35% of simplified chars, so a font
// is only used when document.fonts can render every glyph of the
// card's key — otherwise fall through the rotation to one that can.
export function pickDrillFontStack(seedKey: string, text: string): string | undefined {
  let h = 0;
  for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  const n = HANZI_FONTS.length;
  for (let step = 0; step < n; step++) {
    const font = HANZI_FONTS[(h + step) % n];
    if (!font.family) return undefined; // system — always renders
    try {
      if (document.fonts?.check(`52px "${font.family}"`, text)) return font.stack;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
