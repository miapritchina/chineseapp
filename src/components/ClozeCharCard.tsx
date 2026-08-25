import { useEffect, useState } from "react";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { clusterFor } from "../lib/confusionClusters";
import { pickClozeTask } from "../lib/drillGen";
import { Entity } from "./Entity";

interface Props {
  word: string;
  gloss: string;
  savedWords: string[];
  // 0–1 performance score (binary: correct pick = 1, wrong = 0). On a
  // miss the masked character is reported too — cloze knows exactly
  // which character failed, so attribution is automatic (v136).
  onScore: (score: number, failedChar?: string) => void;
  // Open the EntitySheet for a tapped character (post-answer).
  onOpenEntity?: (key: string) => void;
}

// Drill 3: the word with one character masked; pick the missing char.
// Distractors come from the masked char's confusion cluster when it
// has one, padded from the user's other saved characters. The gloss is
// hidden until after the pick (rebalance stage 3) — with it visible
// the drill collapsed into reverse recognition; without it, cloze
// tests orthographic/collocational knowledge, a distinct facet.
export function ClozeCharCard({ word, gloss, savedWords, onScore, onOpenEntity }: Props) {
  const [task] = useState(() => pickClozeTask(word, savedWords, clusterFor));
  const [picked, setPicked] = useState<string | null>(null);
  const isCorrect = picked !== null && task !== null && picked === task.answer;

  useEffect(() => {
    if (picked !== null) autoSpeak(word);
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
    if (isCorrect) onScore(1);
    else onScore(0, task.answer);
  };

  return (
    <div
      className={`phonetic-tap${picked !== null ? " is-tappable" : ""}`}
      onClick={picked !== null ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Fill the gap</div>
        <div className="cloze-word">
          {glyphs.map((g, i) =>
            i === task.maskIndex && picked === null ? (
              <span key={i} className="cloze-blank" aria-label="missing character">
                ▢
              </span>
            ) : (
              <span
                key={i}
                className={`${i === task.maskIndex ? "cloze-solved" : ""}${
                  picked !== null && onOpenEntity ? " is-explorable" : ""
                }`.trim()}
                onClick={
                  picked !== null && onOpenEntity
                    ? (e) => {
                        e.stopPropagation();
                        onOpenEntity(i === task.maskIndex ? task.answer : g);
                      }
                    : undefined
                }
              >
                {i === task.maskIndex ? task.answer : g}
              </span>
            ),
          )}
        </div>
        {picked !== null && <div className="review-gloss">{gloss || "(no dictionary entry)"}</div>}
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
                // Before answering a tap IS the answer; afterwards it
                // opens the character's sheet.
                onTap={
                  picked === null
                    ? () => setPicked(c)
                    : onOpenEntity
                      ? () => onOpenEntity(c)
                      : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
