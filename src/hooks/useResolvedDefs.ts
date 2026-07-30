import { useEffect } from "react";
import { useDictCtx } from "../state/contexts";
import { crossRefTargets, resolveCrossRefs } from "../lib/gloss";

// Definitions with "variant of X" cross-references resolved to X's
// actual meaning. Fetches the referenced word in the background; the
// resolved text fills in when the cache lands (findWord's identity
// changes with the cache).
export function useResolvedDefs(defs: string[]): string[] {
  const { findWord, ensureCached } = useDictCtx();
  // Callers pass a fresh array each render — key the fetch effect on
  // the joined targets so it doesn't re-fire (or re-fetch a word the
  // dictionary simply doesn't have) every render.
  const targetsKey = crossRefTargets(defs).join("\n");
  useEffect(() => {
    if (targetsKey) void ensureCached(targetsKey.split("\n"));
  }, [targetsKey, ensureCached]);
  return resolveCrossRefs(defs, findWord);
}
