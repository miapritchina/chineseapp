import type { Word } from "../../lib/types";
import { useCharsCtx, useDictCtx } from "../../state/contexts";

// "Nº NN · CHARACTERS / IN YOUR SAVED WORDS" section: lists the chars
// inside a multi-char word, or — for a char — other saved words that
// contain it. Each row taps into its own EntitySheet.

interface Props {
  num: string;
  isMultiCharWord: boolean;
  word: Word | null | undefined;
  matches: string[];
  onOpenWord: (word: string) => void;
  onOpenChar: (char: string) => void;
}

export function RelatedSection({
  num,
  isMultiCharWord,
  word,
  matches,
  onOpenWord,
  onOpenChar,
}: Props) {
  const { chars } = useCharsCtx();
  const { findWord } = useDictCtx();

  return (
    <section className="sheet-section">
      <div className="sheet-section-head">
        <span className="sheet-section-num">Nº {num}</span>
        <span className="sheet-section-name">
          {isMultiCharWord ? "CHARACTERS" : "IN YOUR SAVED WORDS"}
        </span>
      </div>
      <div className="sheet-saved-list">
        {isMultiCharWord && word
          ? [...word.word].map((c, i) => {
              const cd = chars[c];
              const gloss = cd?.definitions?.[0] ?? "";
              return (
                <button
                  key={`${c}-${i}`}
                  className="sheet-saved-row"
                  type="button"
                  onClick={() => onOpenChar(c)}
                >
                  <span className="sheet-saved-hanzi">{c}</span>
                  {cd?.pinyin && <span className="sheet-saved-pinyin">{cd.pinyin}</span>}
                  {gloss && <span className="sheet-saved-gloss">{gloss}</span>}
                </button>
              );
            })
          : matches.map((w) => {
              const wd = findWord(w);
              const gloss = wd?.definitions?.[0] ?? "";
              return (
                <button
                  key={w}
                  className="sheet-saved-row"
                  type="button"
                  onClick={() => onOpenWord(w)}
                >
                  <span className="sheet-saved-hanzi">{w}</span>
                  {wd?.pinyin && <span className="sheet-saved-pinyin">{wd.pinyin}</span>}
                  {gloss && <span className="sheet-saved-gloss">{gloss}</span>}
                </button>
              );
            })}
      </div>
    </section>
  );
}
