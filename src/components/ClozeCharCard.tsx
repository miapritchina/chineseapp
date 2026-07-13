import { useEffect, useState } from "react";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { clusterFor } from "../lib/confusionClusters";
import { pickClozeTask } from "../lib/drillGen";
import { Entity } from "./Entity";

interface Props {
  word: string;
  gloss: string;
  savedWords: string[];
  onGrade: (rating: RatingName) => void;
}

// Drill 3: the word with one character masked; pick the missing char.
// Distractors come from the masked char's confusion cluster when it
// has one, padded from the user's other saved characters.
export function ClozeCharCard({ word, gloss, savedWords, onGrade }: Props) {
  const [task] = useState(() => pickClozeTask(word, savedWords, clusterFor));
  const [picked, setPicked] = useState<string | null>(null);
  const isCorrect = picked !== null && task !== null && picked === task.answer;

  useEffect(() => {
    if (picked !== null) speak(word);
  }, [picked, word]);
  useEffect(() => () => stopSpeech(), []);

  if (!task) {
    return (
      <div className="phonetic-tap">
        <div className="phonetic-tap-prompt">Not enough material for this word yet. Tap Skip.</div>
      </div>
    );
  }

  const glyphs = [...word];
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
        <div className="phonetic-tap-prompt">Which character completes the word?</div>
        <div className="cloze-word">
          {glyphs.map((g, i) =>
            i === task.maskIndex && picked === null ? (
              <span key={i} className="cloze-blank" aria-label="missing character">
                ▢
              </span>
            ) : (
              <span key={i} className={i === task.maskIndex ? "cloze-solved" : undefined}>
                {i === task.maskIndex ? task.answer : g}
              </span>
            ),
          )}
        </div>
        <div className="review-gloss">{gloss || "(no dictionary entry)"}</div>
        <div className="phonetic-tap-row">
          {task.options.map((c) => {
            const isThisAnswer = c === task.answer;
            const isPicked = picked === c;
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
                key={c}
                itemKey={c}
                size="tiny"
                showPinyin={false}
                showMeaning={false}
                ariaLabel={c}
                className={`phonetic-tap-pick ${flash}`.trim()}
                onTap={picked === null ? () => setPicked(c) : undefined}
              />
            );
          })}
        </div>
        {picked !== null && <div className="drill-tap-hint">Tap anywhere to continue →</div>}
      </div>
    </div>
  );
}
