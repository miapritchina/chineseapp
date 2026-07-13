import { useEffect, useState } from "react";
import type { Word } from "../lib/types";
import { speak, stopSpeech } from "../lib/speech";
import { Entity } from "./Entity";

interface Props {
  word: Word;
  // "Got it" cascades credit to the constituent chars; "Missed" writes
  // nothing (the word isn't saved — there's no card to punish).
  onGotIt: () => void;
  onMissed: () => void;
}

// Drill 1 (owner's idea): a real word the user has NOT saved, built
// entirely from characters inside their saved words. Guess the
// meaning, reveal, self-grade.
export function WordInferenceCard({ word, onGotIt, onMissed }: Props) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) speak(word.word);
  }, [revealed, word.word]);
  useEffect(() => () => stopSpeech(), []);

  return (
    <div
      className="phonetic-tap"
      onClick={!revealed ? () => setRevealed(true) : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!revealed && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          setRevealed(true);
        }
      }}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">
          New word from your characters — what could it mean?
        </div>
        <Entity
          word={word}
          size="hero"
          showPinyin={false}
          showMeaning={false}
          ariaLabel={word.word}
        />
        {!revealed ? (
          <div className="review-tap-hint">Tap to reveal</div>
        ) : (
          <>
            <div className="review-pinyin review-pinyin-lg">{word.pinyin}</div>
            <div className="review-gloss">{(word.definitions || []).slice(0, 3).join("; ")}</div>
            <div className="inference-grade-row">
              <button
                type="button"
                className="review-btn review-btn-again"
                onClick={(e) => {
                  e.stopPropagation();
                  onMissed();
                }}
              >
                Missed
              </button>
              <button
                type="button"
                className="review-btn review-btn-good"
                onClick={(e) => {
                  e.stopPropagation();
                  onGotIt();
                }}
              >
                Got it
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
