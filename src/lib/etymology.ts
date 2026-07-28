// Dictionary etymology notes are templated: most begin with boilerplate
// ("Phonosemantic compound. 口 represents the meaning and 厅 represents
// the sound." / "Simplified form of 聽.") that only repeats what the
// role-colored component breakdown already shows — and buries the
// occasional genuinely useful sentence ("The right side looks like 斤
// (axe) but is actually a corruption of 厅."). Strip those boilerplate
// sentences everywhere notes render; keep everything else (owner
// request, v111). Returns "" when nothing survives so callers can fall
// back to their next-best line.
export function cleanEtymologyNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  const sentences = notes.split(/(?<=\.)\s+/);
  const kept = sentences.filter((s) => {
    const t = s.trim();
    if (!t) return false;
    if (/^phono-?semantic compound\.?$/i.test(t)) return false;
    if (
      /^.{1,20} represents the (meaning|sound),? and .{1,20} represents the (meaning|sound)\.?$/i.test(
        t,
      )
    ) {
      return false;
    }
    // Only the bare cross-reference sentence — a longer sentence that
    // continues ("Simplified form of 聽, which depicts …") is content.
    if (/^simplified form of .{1,6}\.?$/i.test(t)) return false;
    return true;
  });
  return kept.join(" ").trim();
}
