import type { Word } from "../lib/types";

interface Props {
  matches: Word[];
  saved: Set<string>;
  onOpen: (word: string) => void;
}

export function ResultsList({ matches, saved, onOpen }: Props) {
  if (matches.length === 0) {
    return <div className="empty-state">No matches.</div>;
  }
  // Saved words first, then the rest. Within each group the RPC's tier
  // ordering is preserved (Array.prototype.sort is stable in ES2019+).
  const ordered = [...matches].sort((a, b) => {
    const sa = saved.has(a.word) ? 0 : 1;
    const sb = saved.has(b.word) ? 0 : 1;
    return sa - sb;
  });
  return (
    <section className="results" aria-label="Search results">
      {ordered.map((w) => {
        const isSaved = saved.has(w.word);
        return (
          <button
            key={w.word}
            className="result-row"
            type="button"
            onClick={() => onOpen(w.word)}
          >
            <div className="r-hanzi">{w.simp}</div>
            <div className="r-mid">
              <div className="r-pinyin">{w.pinyin}</div>
              <div className="r-gloss">{(w.definitions || []).join("; ")}</div>
            </div>
            {isSaved && (
              <span className="r-saved" aria-label="In your saved list" title="Saved">
                ★
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
