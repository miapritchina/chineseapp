// Pure data-builder for the components graph. Lives in its own module so the
// page can import it via <script type="module"> and the Node test runner can
// import the same code without spinning up jsdom.
//
// Universe is bounded by the user's saved set:
//   - Word      = every saved entry (length 1 OR more — single-character
//                 entries like 我 are still words to the user)
//   - Char      = transit nodes for chars inside multi-char words that
//                 ARE NOT themselves saved as a word; never user-facing
//                 saves
//   - Component = direct (one-level) components of any char-or-word above,
//                 EXCLUDING anything already a word or char node — no
//                 double rendering

const CHARACTERLESS = "◎";

/**
 * @param {object} opts
 * @param {string[]} opts.savedWords
 * @param {Set<string>} opts.learnedSet
 * @param {Set<string>} opts.wroteSet
 * @param {Record<string, {components?: Array<{char: string, type?: string}>}>} opts.chars
 * @returns {{nodes: Array<object>, edges: Array<object>}}
 */
export function buildGraph({ savedWords, learnedSet, wroteSet, chars }) {
  // De-dupe saves while preserving first-seen order.
  const wordList = [];
  const wordSet = new Set();
  for (const w of savedWords) {
    if (typeof w !== "string" || !w) continue;
    if (wordSet.has(w)) continue;
    wordSet.add(w);
    wordList.push(w);
  }

  // Chars that appear inside a multi-char word AND aren't themselves saved.
  // These are transit nodes — they exist to give shared structure something
  // to attach to even when the user hasn't explicitly saved the character.
  const charSet = new Set();
  for (const w of wordList) {
    if ([...w].length > 1) {
      for (const c of w) {
        if (!wordSet.has(c)) charSet.add(c);
      }
    }
  }

  // Char-level keys are anything we walk components for: chars in charSet
  // plus single-character words (which are both word and char in spirit;
  // we render them as word nodes only).
  const charLevelKeys = new Set(charSet);
  for (const w of wordList) {
    if ([...w].length === 1) charLevelKeys.add(w);
  }

  // Component layer.
  const componentRole = new Map();
  for (const k of charLevelKeys) {
    const cd = chars[k];
    if (!cd?.components) continue;
    for (const comp of cd.components) {
      const cc = comp?.char;
      if (!cc || cc === CHARACTERLESS) continue;
      if (wordSet.has(cc)) continue;
      if (charSet.has(cc)) continue;
      if (!componentRole.has(cc)) {
        componentRole.set(cc, comp.type || "unknown");
      }
    }
  }

  const tierOf = (key) =>
    wroteSet.has(key) ? "wrote" : learnedSet.has(key) ? "learned" : "saved";

  // Resolve a character-key to its node ID across all three layers.
  const idFor = (key) => {
    if (wordSet.has(key)) return "w:" + key;
    if (charSet.has(key)) return "c:" + key;
    if (componentRole.has(key)) return "p:" + key;
    return null;
  };

  const nodes = [];
  for (const w of wordList) {
    nodes.push({
      data: { id: "w:" + w, kind: "word", label: w, len: [...w].length, tier: tierOf(w) },
    });
  }
  for (const c of charSet) {
    nodes.push({
      data: { id: "c:" + c, kind: "char", label: c },
    });
  }
  for (const [cc, role] of componentRole) {
    nodes.push({
      data: { id: "p:" + cc, kind: "component", label: cc, role },
    });
  }

  const edges = [];
  // Membership: char (or word) inside multi-char word.
  for (const w of wordList) {
    if ([...w].length <= 1) continue;
    const seen = new Set();
    for (const c of w) {
      if (seen.has(c)) continue;
      seen.add(c);
      const sourceId = idFor(c);
      if (!sourceId) continue;
      edges.push({
        data: { id: `e:c2w:${c}-${w}`, source: sourceId, target: "w:" + w, kind: "cw" },
      });
    }
  }
  // Decomposition: component inside char or single-char word.
  for (const k of charLevelKeys) {
    const cd = chars[k];
    if (!cd?.components) continue;
    const seen = new Set();
    for (const comp of cd.components) {
      const cc = comp?.char;
      if (!cc || cc === CHARACTERLESS) continue;
      if (seen.has(cc)) continue;
      seen.add(cc);
      const sourceId = idFor(cc);
      const targetId = idFor(k);
      if (!sourceId || !targetId) continue;
      edges.push({
        data: { id: `e:p2c:${cc}-${k}`, source: sourceId, target: targetId, kind: "pc" },
      });
    }
  }

  return { nodes, edges };
}
