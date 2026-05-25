import { useSavedCtx } from "../../state/contexts";
import { Entity } from "../Entity";

// "RELATED WORDS" — one column per unique character in `wordKey`; each
// column lists the user's other saved words that contain that
// character. The key itself is excluded from every column. Repeated
// characters (妈妈 → 妈) collapse into a single column. Used by both the
// multi-char-word sheet (one column per char in the word) AND the
// single-char sheet (one column for the char itself). Each related
// word renders as <Entity size="sm"> so the tile DNA stays consistent.

interface Props {
  wordKey: string;
  onOpenWord: (word: string) => void;
}

export function RelatedWordsColumns({ wordKey, onOpenWord }: Props) {
  const { saved } = useSavedCtx();

  const seen = new Set<string>();
  const uniqueChars = [...wordKey].filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
  const columns = uniqueChars.map((c) => ({
    char: c,
    matches: [...saved].filter((w) => w !== wordKey && w.includes(c)),
  }));

  return (
    <section className="sheet-section">
      <div className="sheet-section-head">
        <span className="sheet-section-name">RELATED WORDS</span>
      </div>
      <div className="sheet-related-cols">
        {columns.map((col) => (
          <div className="sheet-related-col" key={col.char}>
            <div className="sheet-related-col-head">{col.char}</div>
            <div className="sheet-related-col-items">
              {col.matches.length === 0 ? (
                <div className="sheet-related-empty-card">…</div>
              ) : (
                col.matches.map((w) => <Entity key={w} itemKey={w} size="sm" onTap={onOpenWord} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
