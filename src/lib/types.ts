// Shared types — mirror the data shape produced by scripts/extract-chinese.mjs.

export type Role = "iconic" | "meaning" | "sound" | "simplified" | "deleted" | "unknown";

export interface Word {
  word: string;
  pinyin: string;
  searchablePinyin: string;
  definitions: string[];
  hsk: number | null;
  rank: number | null;
  trad?: string;
  // Hydrated client-side:
  simp: string;
  chars: string[];
}

export interface Component {
  char: string;
  type: Role;
  pinyin: string;
  definition: string;
  hint: string;
  fragment: [number, number?] | null;
}

export interface Char {
  char: string;
  pinyin: string;
  definitions: string[];
  originalMeaning: string;
  notes: string;
  components: Component[];
  hasEtymology: boolean;
}

export interface DataWords {
  generated: string;
  source: string;
  words: Word[];
}

export interface DataChars {
  chars: Record<string, Char>;
}

export interface TreeNode {
  char: string;
  role: Role | "word";
  depth: number;
  isWord?: boolean;
  pinyin?: string;
  gloss?: string;
  fragment?: [number, number?] | null;
  compPinyin?: string;
  compDef?: string;
  children: TreeNode[];
}

export type ModalEntry =
  | { kind: "word"; key: string }
  | { kind: "char"; key: string };
