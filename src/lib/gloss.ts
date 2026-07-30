// Cross-reference gloss resolution (v115, owner request): CC-CEDICT
// definitions like "erhua variant of 一塊|一块[yī kuài]" explain
// nothing on their own — pull the target word's actual meaning in at
// display time. Resolution is cache-only (lookup = findWord); callers
// ensureCached the targets so the meaning fills in as it lands.

import type { Word } from "./types";

const XREF =
  /^((?:erhua |old |archaic )?variant of)\s+([㐀-鿿]+)(?:\|([㐀-鿿]+))?(?:\s*\[([^\]]*)\])?\s*$/i;

// Simplified-form target of a cross-reference definition, or null.
export function crossRefTarget(def: string): string | null {
  const m = XREF.exec(def.trim());
  if (!m) return null;
  return m[3] || m[2];
}

export function crossRefTargets(defs: string[]): string[] {
  return defs.map(crossRefTarget).filter((t): t is string => !!t);
}

export function resolveCrossRefs(defs: string[], lookup: (word: string) => Word | null): string[] {
  return defs.map((d) => {
    const target = crossRefTarget(d);
    if (!target) return d;
    const kind = /^erhua/i.test(d.trim()) ? "casual 儿-form of" : "variant of";
    const gloss = (lookup(target)?.definitions ?? [])
      .filter((x) => !crossRefTarget(x))
      .slice(0, 2)
      .join("; ");
    return gloss ? `${kind} ${target}: ${gloss}` : `${kind} ${target}`;
  });
}
