import { useRef } from "react";
import type { Word } from "../../lib/types";
import { POS_COLOR, POS_LABEL, type Pos } from "../../lib/pos";
import { hanziScaleStyle } from "../../lib/hanzi";
import { HanziGlyph, type HanziGlyphHandle } from "../ui/HanziGlyph";
import { SpeakButton } from "../ui/SpeakButton";

// Header block of the EntitySheet: eyebrow (pinyin · tone · freq), the
// hanzi glyph (stroke-animated for single chars, plain + 🔊 for
// multi-char words), and the POS + glosses row.

interface Props {
  itemKey: string;
  word: Word | null | undefined;
  isMultiCharWord: boolean;
  pinyin: string;
  tone: string | null;
  freq: string | null;
  pos: Pos | null;
  defs: string[];
}

export function SheetHeader({
  itemKey,
  word,
  isMultiCharWord,
  pinyin,
  tone,
  freq,
  pos,
  defs,
}: Props) {
  const glyphRef = useRef<HanziGlyphHandle>(null);
  const replay = () => glyphRef.current?.replay();

  return (
    <>
      <div className="sheet-eyebrow">
        <span>{pinyin ? pinyin.toUpperCase() : itemKey}</span>
        {tone && <span className="sheet-eyebrow-dim"> · {tone}</span>}
        {freq && <span className="sheet-eyebrow-dim"> · {freq.toUpperCase()}</span>}
      </div>

      {isMultiCharWord && word ? (
        <div className="sheet-glyph sheet-glyph-word" style={hanziScaleStyle(word.word)}>
          <span className="sheet-glyph-text">{word.word}</span>
          <SpeakButton text={word.word} className="sheet-speak" />
        </div>
      ) : (
        <div
          className="sheet-glyph"
          role="button"
          tabIndex={0}
          aria-label={`Replay stroke animation for ${itemKey}`}
          onClick={replay}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              replay();
            }
          }}
        >
          <HanziGlyph ref={glyphRef} char={itemKey} mode="animate" />
        </div>
      )}

      <div className="sheet-defs">
        {pos && (
          <span className="sheet-pos" style={{ color: POS_COLOR[pos] }}>
            {POS_LABEL[pos].toUpperCase()}
          </span>
        )}
        {pos && <span className="sheet-defs-sep"> • </span>}
        {defs.length ? (
          <span className="sheet-defs-text">{defs.join(" · ")}</span>
        ) : (
          <span className="sheet-defs-text sheet-muted">No dictionary entry.</span>
        )}
      </div>
    </>
  );
}
