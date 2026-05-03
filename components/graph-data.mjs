// Pure data-builder for the components graph. Lives in its own module so the
// page can import it via <script type="module"> and the Node test runner can
// import the same code without spinning up jsdom.
//
// Universe is bounded by the user's saved set:
//   - Words      = saved entries with length > 1
//   - Chars      = every char inside a saved word, plus any single-char saves
//   - Components = direct (one-level) components of every char above,
//                  EXCLUDING anything that's already a char node
//                  (no double rendering).

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
  const words = [];
  const charSet = new Set();
  const charSavedAsChar = new Set();

  for (const w of savedWords) {
    if (typeof w !== "string" || !w) continue;
    const len = [...w].length;
    if (len > 1) {
      words.push(w);
      for (const c of w) charSet.add(c);
    } else if (len === 1) {
      charSet.add(w);
      charSavedAsChar.add(w);
    }
  }

  // Component layer.
  const componentRole = new Map();
  for (const c of charSet) {
    const cd = chars[c];
    if (!cd?.components) continue;
    for (const comp of cd.components) {
      const cc = comp?.char;
      if (!cc || cc === CHARACTERLESS) continue;
      if (charSet.has(cc)) continue;
      if (!componentRole.has(cc)) {
        componentRole.set(cc, comp.type || "unknown");
      }
    }
  }

  const tierOf = (key) =>
    wroteSet.has(key) ? "wrote" : learnedSet.has(key) ? "learned" : "saved";

  const nodes = [];
  for (const w of words) {
    nodes.push({
      data: { id: "w:" + w, kind: "word", label: w, len: [...w].length, tier: tierOf(w) },
    });
  }
  for (const c of charSet) {
    nodes.push({
      data: {
        id: "c:" + c,
        kind: "char",
        label: c,
        savedAsChar: charSavedAsChar.has(c),
        tier: charSavedAsChar.has(c) ? tierOf(c) : null,
      },
    });
  }
  for (const [cc, role] of componentRole) {
    nodes.push({
      data: { id: "p:" + cc, kind: "component", label: cc, role },
    });
  }

  const edges = [];
  for (const w of words) {
    const seen = new Set();
    for (const c of w) {
      if (seen.has(c)) continue;
      seen.add(c);
      edges.push({
        data: { id: `e:c2w:${c}-${w}`, source: "c:" + c, target: "w:" + w, kind: "cw" },
      });
    }
  }
  for (const c of charSet) {
    const cd = chars[c];
    if (!cd?.components) continue;
    const seen = new Set();
    for (const comp of cd.components) {
      const cc = comp?.char;
      if (!cc || cc === CHARACTERLESS) continue;
      if (charSet.has(cc)) continue;
      if (seen.has(cc)) continue;
      seen.add(cc);
      edges.push({
        data: { id: `e:p2c:${cc}-${c}`, source: "p:" + cc, target: "c:" + c, kind: "pc" },
      });
    }
  }

  return { nodes, edges };
}
