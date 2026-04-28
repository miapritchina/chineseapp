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
  return (
    <section className="results" aria-label="Search results">
      {matches.map((w) => {
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
              <div className="r-gloss">{(w.definitions || []).slice(0, 3).join("; ")}</div>
            </div>
            <div className="r-meta">
              {isSaved && (
                <span className="r-saved" aria-label="In your saved list" title="Saved">
                  ★
                </span>
              )}
              {w.hsk != null && <div className="r-hsk">HSK {w.hsk}</div>}
            </div>
          </button>
        );
      })}
    </section>
  );
}
