import { useEffect, useState } from "react";
import type { Word } from "../lib/types";
import { speak, stopSpeech } from "../lib/speech";
import { pickGlossOptions } from "../lib/drillGen";
import { useCharsCtx } from "../state/contexts";

interface Props {
  word: Word;
  // Distractor glosses (other inference words + saved words). The card
  // shows 4 meaning options; picking the right one credits the chars.
  glossPool: string[];
  onGotIt: () => void;
  onMissed: () => void;
}

// Drill 1 (owner's idea): a real word the user has NOT saved, built
// entirely from characters inside their saved words. v103: pick the
// meaning among 4 options; the reveal shows each character as a
// pinyin → hanzi → meaning stack (the sheet treatment).
export function WordInferenceCard({ word, glossPool, onGotIt, onMissed }: Props) {
  const { chars } = useCharsCtx();
  const gloss = (word.definitions || []).slice(0, 2).join("; ") || "(no dictionary entry)";
  const [options] = useState(() => pickGlossOptions(gloss, glossPool));
  const [picked, setPicked] = useState<string | null>(null);
  const isCorrect = picked !== null && picked === gloss;

  useEffect(() => {
    if (picked !== null) speak(word.word);
  }, [picked, word.word]);
  useEffect(() => () => stopSpeech(), []);

  const advance = () => {
    if (picked === null) return;
    if (isCorrect) onGotIt();
    else onMissed();
  };

  return (
    <div
      className={`phonetic-tap${picked !== null ? " is-tappable" : ""}`}
      onClick={picked !== null ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">
          New word from your characters — what does it mean?
        </div>
        <div className="inference-hanzi">{word.word}</div>
        {picked === null ? (
          options ? (
            <div className="inference-options">
              {options.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="inference-option"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked(g);
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          ) : (
            // Pool too small for multiple choice — free recall fallback.
            <button
              type="button"
              className="review-btn review-btn-reveal"
              onClick={(e) => {
                e.stopPropagation();
                setPicked(gloss);
              }}
            >
              Reveal
            </button>
          )
        ) : (
          <>
            {options && (
              <div className="inference-options">
                {options.map((g) => {
                  const cls =
                    g === picked && isCorrect
                      ? "is-correct"
                      : g === picked
                        ? "is-wrong"
                        : g === gloss
                          ? "is-reveal"
                          : "";
                  return (
                    <button
                      key={g}
                      type="button"
                      disabled
                      className={`inference-option ${cls}`.trim()}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="review-pinyin review-pinyin-lg">{word.pinyin}</div>
            {/* Per-character breakdown — the sheet's pinyin/hanzi/meaning stacks. */}
            <div className="classic-phrase inference-breakdown">
              {[...word.word].map((c, i) => {
                const cd = chars?.[c];
                return (
                  <span className="sheet-etym-piece" key={`${c}-${i}`}>
                    <span className="sheet-etym-piece-pinyin">{cd?.pinyin ?? ""}</span>
                    <span className="sheet-etym-glyph">{c}</span>
                    <span className="sheet-etym-piece-meaning">{cd?.definitions?.[0] ?? ""}</span>
                  </span>
                );
              })}
            </div>
            <div className="drill-tap-hint">Tap anywhere to continue →</div>
          </>
        )}
      </div>
    </div>
  );
}
