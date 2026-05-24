// One-line frequency band for the corpus rank. The user asked: no HSK,
// but keep a hint. Ranges loosely follow the chinese-lexicon rank
// distribution.
export function commonnessLabel(rank: number | null | undefined): string | null {
  if (rank == null) return null;
  if (rank < 1000) return "Top 1 000";
  if (rank < 3000) return "Top 3 000";
  if (rank < 10000) return "Top 10 000";
  return "Less common";
}

// Reads the role palette from CSS (--role-* in :root / styles.css) so
// there's one source of truth — keep in step with the .role-* /
// .node-card.role-* rules and design-tokens.css.
export function roleColor(type: string | undefined): string | undefined {
  switch (type) {
    case "sound":
      return "var(--role-sound)";
    case "meaning":
      return "var(--role-meaning)";
    case "iconic":
      return "var(--role-iconic)";
    default:
      return undefined;
  }
}
