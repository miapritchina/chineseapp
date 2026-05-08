// Saved-words search by component. Pure ES module so it can be imported
// from both the TS app code and the Node test runner without a build step.

const CHARACTERLESS = "◎";

// Walk a character's component tree and accumulate every character it's
// built from at any depth, including itself. `visited` guards against
// cycles in the source data (variant components, self-references).
function collectComponents(start, chars, out, visited) {
  if (!start || start === CHARACTERLESS) return;
  if (visited.has(start)) return;
  visited.add(start);
  out.add(start);
  const cd = chars[start];
  if (!cd?.components) return;
  for (const comp of cd.components) {
    if (comp?.char) collectComponents(comp.char, chars, out, visited);
  }
}

/**
 * Every character in the recursive component closure of `word`,
 * including the chars in word themselves.
 * @param {string} word
 * @param {Record<string, {components?: Array<{char: string}>}>} chars
 * @returns {Set<string>}
 */
export function componentClosure(word, chars) {
  const out = new Set();
  for (const c of word) collectComponents(c, chars, out, new Set());
  return out;
}

/**
 * Frequency map of every Han character that shows up in the recursive
 * component closure of any of `savedWords`. Counts how many distinct saved
 * words each component occurs in (NOT total occurrences across closures).
 * Used to populate the suggestion grid in by-component search mode.
 * @param {string[]} savedWords
 * @param {Record<string, {components?: Array<{char: string}>}>} chars
 * @returns {Map<string, number>}
 */
export function componentFrequencies(savedWords, chars) {
  const counts = new Map();
  for (const w of savedWords) {
    const closure = componentClosure(w, chars);
    for (const c of closure) {
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Return saved words whose component closure contains EVERY Chinese
 * character in `query`. Empty / non-Han query → empty result. Saved-list
 * order is preserved.
 * @param {string} query
 * @param {string[]} savedWords
 * @param {Record<string, {components?: Array<{char: string}>}>} chars
 * @returns {string[]}
 */
export function searchByComponent(query, savedWords, chars) {
  const targets = [...query].filter((c) => /\p{Script=Han}/u.test(c));
  if (targets.length === 0) return [];
  const matches = [];
  for (const w of savedWords) {
    const closure = componentClosure(w, chars);
    if (targets.every((t) => closure.has(t))) matches.push(w);
  }
  return matches;
}
