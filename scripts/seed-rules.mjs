// Pure entry-selection rules shared by seed-supabase.mjs (and tested
// by test-seed-rules.mjs). Split out after the 笑 bug (v134): CC-CEDICT
// has two entries with simp 笑 — "to laugh" and 咲 "old variant of
// 笑[xiào]" — and the old dedup kept the variant row, erasing "to
// laugh" from the dictionary.

// A definition that only points somewhere else ("variant of X",
// "old/archaic/erhua variant of X", "see X", "also written X") —
// prefixed variants included, which the old /^variant of / test missed.
const CROSS_REF_RE =
  /^(?:(?:old|archaic|erhua|common|Japanese)\s+)?variant of\s|^see (?:also )?[㐀-鿿]|^also written\s|^also pr[.\s]/i;

export function isCrossRefDef(def) {
  return CROSS_REF_RE.test((def || "").trim());
}

export function isOnlyCrossRef(entry) {
  const defs = entry.definitions || [];
  if (defs.length === 0) return true;
  return defs.every((d) => isCrossRefDef(d));
}

// Among entries sharing one simplified form, keep the most useful one:
// most substantive (non-cross-ref) definitions first, then the more
// frequent (lower movie rank), then input order. Input order is
// preserved for unique words.
export function dedupBySimp(entries) {
  const substantive = (e) => (e.definitions || []).filter((d) => !isCrossRefDef(d)).length;
  const rank = (e) => e.statistics?.movieWordRank ?? Infinity;
  const bySimp = new Map();
  for (const e of entries) {
    const prev = bySimp.get(e.simp);
    if (!prev) {
      bySimp.set(e.simp, e);
      continue;
    }
    if (
      substantive(e) > substantive(prev) ||
      (substantive(e) === substantive(prev) && rank(e) < rank(prev))
    ) {
      bySimp.set(e.simp, e);
    }
  }
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (seen.has(e.simp)) continue;
    seen.add(e.simp);
    out.push(bySimp.get(e.simp));
  }
  return out;
}
