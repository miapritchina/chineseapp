import { useEffect, useState } from "react";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { pickReverseOptions } from "../lib/drillGen";
import { Entity } from "./Entity";

interface Props {
  answer: string;
  gloss: string;
  savedWords: string[];
  // Tap correct → Good, tap wrong → Again (reveal first, advance on tap).
  onGrade: (rating: RatingName) => void;
}

// Drill 2: gloss → pick the hanzi. Distractors prefer saved words
// sharing a character with the answer.
export function ReverseRecognitionCard({ answer, gloss, savedWords, onGrade }: Props) {
  const [options] = useState(() => pickReverseOptions(answer, savedWords));
  const [picked, setPicked] = useState<string | null>(null);
  const isCorrect = picked !== null && picked === answer;

  useEffect(() => {
    if (picked !== null) speak(answer);
  }, [picked, answer]);
  useEffect(() => () => stopSpeech(), []);

  if (!options) {
    return (
      <div className="phonetic-tap">
        <div className="phonetic-tap-prompt">
          Save a second word to unlock this drill. Tap Skip.
        </div>
      </div>
    );
  }

  const advance = () => {
    if (picked === null) return;
    onGrade(isCorrect ? "Good" : "Again");
  };

  return (
    <div
      className={`phonetic-tap${picked !== null ? " is-tappable" : ""}`}
      onClick={picked !== null ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Which word means…</div>
        <div className="reverse-gloss">{gloss || "(no dictionary entry)"}</div>
        <div className="phonetic-tap-row reverse-row">
          {options.map((w) => {
            const isThisAnswer = w === answer;
            const isPicked = picked === w;
            const flash =
              isPicked && isCorrect
                ? "is-correct"
                : isPicked && !isCorrect
                  ? "is-wrong"
                  : picked !== null && !isCorrect && isThisAnswer
                    ? "is-reveal"
                    : "";
            return (
              <Entity
                key={w}
                itemKey={w}
                size="sm"
                showPinyin={picked !== null && isThisAnswer}
                showMeaning={false}
                showStatus={false}
                ariaLabel={w}
                className={`reverse-pick ${flash}`.trim()}
                onTap={picked === null ? () => setPicked(w) : undefined}
              />
            );
          })}
        </div>
        {picked !== null && <div className="drill-tap-hint">Tap anywhere to continue →</div>}
      </div>
    </div>
  );
}
