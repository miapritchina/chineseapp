import type { Char } from "../../lib/types";
import { useCharsCtx } from "../../state/contexts";

// "ETYMOLOGY / MADE OF" section: role-colored decomposition equation +
// the etymological note (if any). Each piece is tappable and opens its
// own EntitySheet. Each piece (and the result) renders as a small
// pinyin → hanzi → meaning stack, mirroring the role-glyph pattern in
// the design-system style-guide.

interface Piece {
  char: string;
  color?: string;
}

interface Props {
  itemKey: string;
  isMultiCharWord: boolean;
  pieces: Piece[];
  charData: Char | undefined;
  resultPinyin?: string;
  resultMeaning?: string;
  onOpenChar: (char: string) => void;
  onOpenTree: () => void;
}

export function EtymologySection({
  itemKey,
  isMultiCharWord,
  pieces,
  charData,
  resultPinyin,
  resultMeaning,
  onOpenChar,
  onOpenTree,
}: Props) {
  const { chars } = useCharsCtx();

  return (
    <section className="sheet-section">
      <div className="sheet-section-head">
        <span className="sheet-section-name">{isMultiCharWord ? "MADE OF" : "ETYMOLOGY"}</span>
      </div>
      {pieces.length > 0 && (
        <div className="sheet-etym-row">
          {pieces.map((p, i) => {
            const cd = chars[p.char];
            const pinyin = cd?.pinyin ?? "";
            const meaning = cd?.definitions?.[0] ?? "";
            return (
              <span key={`${p.char}-${i}`} className="sheet-etym-piece">
                {i > 0 && <span className="sheet-etym-op">+</span>}
                {pinyin && <span className="sheet-etym-piece-pinyin">{pinyin}</span>}
                <button
                  type="button"
                  className="sheet-etym-glyph sheet-etym-glyph-btn"
                  style={p.color ? { color: p.color } : undefined}
                  onClick={() => onOpenChar(p.char)}
                  title={`Open ${p.char}`}
                >
                  {p.char}
                </button>
                {meaning && <span className="sheet-etym-piece-meaning">{meaning}</span>}
              </span>
            );
          })}
          <span className="sheet-etym-op">=</span>
          <span className="sheet-etym-piece">
            {resultPinyin && <span className="sheet-etym-piece-pinyin">{resultPinyin}</span>}
            <span className="sheet-etym-glyph sheet-etym-result">{itemKey}</span>
            {resultMeaning && <span className="sheet-etym-piece-meaning">{resultMeaning}</span>}
          </span>
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
