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
  // Open the EntitySheet for a tapped character (post-answer).
  onOpenEntity?: (key: string) => void;
}

// Drill 1 (owner's idea): a real word the user has NOT saved, built
// entirely from characters inside their saved words. v103: pick the
// meaning among 4 options; the reveal shows each character as a
// pinyin → hanzi → meaning stack (the sheet treatment).
export function WordInferenceCard({ word, glossPool, onGotIt, onMissed, onOpenEntity }: Props) {
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
        <div
          className={`inference-hanzi${picked !== null && onOpenEntity ? " is-explorable" : ""}`}
          onClick={
            picked !== null && onOpenEntity
              ? (e) => {
                  e.stopPropagation();
                  onOpenEntity(word.word);
                }
              : undefined
          }
        >
          {word.word}
        </div>
        {/* Pinyin shows BEFORE answering (owner request, v110) — the
            word is new, sound is fair help for guessing the meaning. */}
        <div className="review-pinyin">{word.pinyin}</div>
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
            {/* Per-character breakdown — the sheet's pinyin/hanzi/meaning
                stacks; each piece opens that character's sheet. */}
            <div className="classic-phrase inference-breakdown">
              {[...word.word].map((c, i) => {
                const cd = chars?.[c];
                return (
                  <span
                    className={`sheet-etym-piece${onOpenEntity ? " is-explorable" : ""}`}
                    key={`${c}-${i}`}
                    onClick={
                      onOpenEntity
                        ? (e) => {
                            e.stopPropagation();
                            onOpenEntity(c);
                          }
                        : undefined
                    }
                  >
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
