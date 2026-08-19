import { useEffect, useState } from "react";
import type { Word } from "../lib/types";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { buildWordTray } from "../lib/drillGen";
import { Entity } from "./Entity";

interface Props {
  word: Word;
  savedWords: string[];
  onGotIt: () => void;
  onMissed: () => void;
  // Open the EntitySheet for a tapped character (post-completion).
  onOpenEntity?: (key: string) => void;
}

// New-words game, build mode (v137, owner's idea): the translation is
// shown and the word is assembled character by character from a tray
// of its glyphs plus decoys from the user's known characters. A wrong
// tap flashes and counts — finishing clean reports gotIt (same
// cascade credit as guessing the meaning), any mistake reports missed.
export function WordBuildCard({ word, savedWords, onGotIt, onMissed, onOpenEntity }: Props) {
  const [task] = useState(() => buildWordTray(word.word, savedWords));
  const [placed, setPlaced] = useState(0);
  const [used, setUsed] = useState<Set<number>>(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);

  const done = task !== null && placed >= task.chars.length;

  useEffect(() => {
    if (done) autoSpeak(word.word);
  }, [done, word.word]);
  useEffect(() => () => stopSpeech(), []);

  if (!task) {
    return (
      <div className="phonetic-tap">
        <div className="phonetic-tap-prompt">Not enough material for this word yet. Tap Skip.</div>
      </div>
    );
  }

  const gloss = (word.definitions || []).slice(0, 2).join("; ");

  const tapChip = (i: number) => {
    if (done || used.has(i)) return;
    if (task.tray[i] === task.chars[placed]) {
      setUsed((prev) => new Set(prev).add(i));
      setPlaced((n) => n + 1);
    } else {
      setMistakes((n) => n + 1);
      setWrongFlash(i);
      window.setTimeout(() => setWrongFlash((cur) => (cur === i ? null : cur)), 350);
    }
  };

  const advance = () => {
    if (!done) return;
    if (mistakes === 0) onGotIt();
    else onMissed();
  };

  return (
    <div
      className={`phonetic-tap${done ? " is-tappable" : ""}`}
      onClick={done ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Build it:</div>
        <div className="reverse-gloss">{gloss || "(no dictionary entry)"}</div>
        <div className="cloze-word">
          {task.chars.map((c, i) =>
            i < placed ? (
              <span
                key={i}
                className={onOpenEntity ? "is-explorable" : undefined}
                onClick={
                  done && onOpenEntity
                    ? (e) => {
                        e.stopPropagation();
                        onOpenEntity(c);
                      }
                    : undefined
                }
              >
                {c}
              </span>
            ) : (
              <span key={i} className="cloze-blank" aria-label="missing character">
                ▢
              </span>
            ),
          )}
        </div>
        {done && <div className="review-pinyin review-pinyin-lg">{word.pinyin}</div>}
        {!done && (
          <div className="phonetic-tap-row">
            {task.tray.map((c, i) =>
              used.has(i) ? (
                <span key={`${c}@${i}`} className="wordbuild-used" aria-hidden="true" />
              ) : (
                <Entity
                  key={`${c}@${i}`}
                  itemKey={c}
                  size="tiny"
                  showPinyin={false}
                  showMeaning={false}
                  ariaLabel={c}
                  className={`phonetic-tap-pick${wrongFlash === i ? " is-wrong" : ""}`}
                  onTap={() => tapChip(i)}
                />
              ),
            )}
          </div>
        )}
        {done && (
          <>
            <div className={`phonetic-tap-feedback ${mistakes === 0 ? "" : "is-wrong"}`.trim()}>
              {mistakes === 0
                ? "Built clean — nice."
                : `${mistakes} wrong tap${mistakes === 1 ? "" : "s"}.`}
            </div>
            <div className="drill-tap-hint">Tap anywhere to continue →</div>
          </>
        )}
      </div>
    </div>
  );
}
