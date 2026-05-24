// Shared types — mirror the data shape produced by scripts/extract-chinese.mjs.

// Dong Chinese component-role taxonomy — see
// https://www.dong-chinese.com/wiki/home#components and the --role-*
// tokens in styles.css :root for the color mapping.
export type Role =
  | "iconic"
  | "meaning"
  | "sound"
  | "remnant"
  | "simplified"
  | "deleted"
  | "distinguishing"
  | "unknown";

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
  // Fragment encodes which strokes of the parent character belong to this
  // component. Even-length arrays are alternating [start, end) pairs;
  // odd-length arrays mean the last value starts a half-open range that ends
  // at the parent's total stroke count. Examples:
  //   [4, 7]      → strokes 4..6
  //   [0, 4, 7]   → strokes 0..3 ∪ 7..end (events 事's "characterless" piece)
  //   [0, 2, 6]   → strokes 0..1 ∪ 6..end (the 囗 in 园)
  fragment: number[] | null;
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
  fragment?: number[] | null;
  compPinyin?: string;
  compDef?: string;
  compHint?: string;
  children: TreeNode[];
}

// `view` picks the surface: "sheet" (default) is the unified
// EntitySheet; "tree" is the full recursive d3 decomposition page.
export type ModalView = "sheet" | "tree";
export type ModalEntry =
  | { kind: "word"; key: string; view?: ModalView }
  | { kind: "char"; key: string; view?: ModalView };

// FSRS item identity. A review row is uniquely keyed by
// (key, kind, facet); a single saved word can produce multiple rows
// across kinds and facets via cascade + facet-split rules.
export type ItemKind = "word" | "char" | "component";
export type Facet =
  | "recognition" // legacy pre-v66 — migrated to meaningRecognition on load
  | "meaningRecognition"
  | "soundRecognition"
  | "phoneticTap"
  | "componentSound"
  | "familyTransfer"
  | "production";

// Unified grade event emitted by every drill component. Centralizes the
// signature so drill callbacks don't all reinvent it.
import type { RatingName } from "./fsrs";
export interface GradeEvent {
  key: string;
  rating: RatingName;
  kind: ItemKind;
  facet: Facet;
}
export type GradeHandler = (event: GradeEvent) => void;
