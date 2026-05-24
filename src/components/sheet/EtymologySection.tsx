import type { Char } from "../../lib/types";

// "Nº NN · ETYMOLOGY / MADE OF" section: role-colored decomposition
// equation + the etymological note (if any). Each piece is tappable and
// opens its own EntitySheet.

interface Piece {
  char: string;
  color?: string;
}

interface Props {
  num: string;
  itemKey: string;
  isMultiCharWord: boolean;
  pieces: Piece[];
  charData: Char | undefined;
  onOpenChar: (char: string) => void;
  onOpenTree: () => void;
}

export function EtymologySection({
  num,
  itemKey,
  isMultiCharWord,
  pieces,
  charData,
  onOpenChar,
  onOpenTree,
}: Props) {
  return (
    <section className="sheet-section">
      <div className="sheet-section-head">
        <span className="sheet-section-num">Nº {num}</span>
        <span className="sheet-section-name">{isMultiCharWord ? "MADE OF" : "ETYMOLOGY"}</span>
      </div>
      {pieces.length > 0 && (
        <div className="sheet-etym-row">
          {pieces.map((p, i) => (
            <span key={`${p.char}-${i}`} className="sheet-etym-piece">
              {i > 0 && <span className="sheet-etym-op">+</span>}
              <button
                type="button"
                className="sheet-etym-glyph sheet-etym-glyph-btn"
                style={p.color ? { color: p.color } : undefined}
                onClick={() => onOpenChar(p.char)}
                title={`Open ${p.char}`}
              >
                {p.char}
              </button>
            </span>
          ))}
          <span className="sheet-etym-op">=</span>
          <span className="sheet-etym-glyph sheet-etym-result">{itemKey}</span>
          <button
            type="button"
            className="sheet-etym-expand"
            aria-label="Open the full decomposition tree"
            title="Full decomposition tree"
            onClick={onOpenTree}
          >
            ⤢
          </button>
        </div>
      )}
      {!isMultiCharWord &&
        charData?.originalMeaning &&
        charData.originalMeaning !== "characterless component" && (
          <div className="sheet-etym-note">Originally: {charData.originalMeaning}</div>
        )}
      {!isMultiCharWord && charData?.notes && (
        <div className="sheet-etym-note sheet-etym-note-em">{charData.notes}</div>
      )}
    </section>
  );
}
