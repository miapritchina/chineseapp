import type { Char, TreeNode, Word } from "./types";

export const CHARACTERLESS = "◎";
export const MAX_TREE_DEPTH = 5;

export const ROLE_LABEL: Record<string, string> = {
  iconic: "Iconic",
  meaning: "Meaning",
  sound: "Sound",
  simplified: "Simplified",
  deleted: "Deleted",
  unknown: "Component",
};

function buildCharNode(
  char: string,
  role: TreeNode["role"],
  chars: Record<string, Char>,
  depth = 0,
  ancestors = new Set<string>(),
): TreeNode {
  if (ancestors.has(char) || depth > MAX_TREE_DEPTH) {
    return { char, role, depth, children: [] };
  }
  const next = new Set(ancestors);
  next.add(char);

  const c = chars[char];
  const node: TreeNode = { char, role, depth, children: [] };
  if (!c?.hasEtymology) return node;

  for (const comp of c.components) {
    // Keep CHARACTERLESS (◎) components — they convey real structure (e.g.
    // 事's ◎ owns strokes 0-3 + 7, with the hand 又 owning 4-6). Skipping
    // them hid the second component entirely. The click handler still
    // refuses to open ◎ since there's no etymology to drill into.
    const child = buildCharNode(comp.char, comp.type || "unknown", chars, depth + 1, next);
    child.fragment = comp.fragment;
    child.compPinyin = comp.pinyin;
    child.compDef = comp.definition;
    child.compHint = comp.hint;
    node.children.push(child);
  }
  return node;
}

export function buildCharTree(char: string, chars: Record<string, Char>): TreeNode {
  return buildCharNode(char, "iconic", chars);
}

export function buildWordTree(w: Word, chars: Record<string, Char>): TreeNode {
  if (w.chars.length === 1) return buildCharTree(w.chars[0], chars);
  return {
    char: w.simp,
    role: "word",
    depth: 0,
    isWord: true,
    pinyin: w.pinyin,
    gloss: w.definitions?.[0] || "",
    children: w.chars.map((ch) => {
      const sub = buildCharTree(ch, chars);
      sub.depth = 1;
      return sub;
    }),
  };
}

export function walkTree(node: TreeNode, fn: (n: TreeNode) => void): void {
  fn(node);
  for (const c of node.children) walkTree(c, fn);
}

// For a stroke at index `idx` in the parent, return the role color of whichever
// child component owns that stroke (per chinese-lexicon's `fragment` ranges),
// or the parent's own role if no child claims it.
export function strokeRoleForIndex(node: TreeNode, idx: number, totalStrokes: number): string {
  for (const child of node.children || []) {
    const f = child.fragment;
    if (!Array.isArray(f)) continue;
    const [s, e] = f;
    const end = e == null ? totalStrokes : e;
    if (idx >= s && idx < end) return child.role || "unknown";
  }
  return node.role || "unknown";
}
