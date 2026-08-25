import { useEffect, useRef, useState } from "react";
import type { Char } from "../lib/types";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { productionScore } from "../lib/drillGen";
import { HanziGlyph } from "./ui/HanziGlyph";

interface Props {
  char: string;
  charData: Char | undefined;
  // 0–1 performance score: 1 − wrongStrokes/strokeCount, so mistakes
  // cost proportionally to character length (rebalance stage 3).
  // Wrong strokes are counted DISTINCT, so repeated misses on the
  // same stroke cost one. Advance happens via the tap-anywhere
  // overlay after the quiz completes.
  onScore: (score: number) => void;
  // Open the EntitySheet for the traced character (post-completion).
  onOpenEntity?: (key: string) => void;
}

// Production drill — "write the character that means X." Reveals the
// meaning + pinyin as the prompt, then the user traces the strokes via
// <HanziGlyph mode="quiz">. Auto-scores on completion based on stroke
// mistakes; Skip lives in the page header.
export function ProductionCard({ char, charData, onScore, onOpenEntity }: Props) {
  const [done, setDone] = useState<{ mistakes: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Total stroke count for the proportional score. HanziWriter has the
  // char data cached by the time the quiz mounts (ReviewPage prefetches
  // it); null until loaded — productionScore falls back to the old
  // distinct-mistake thresholds if it never arrives.
  const [strokeCount, setStrokeCount] = useState<number | null>(null);
  // Distinct WRONG STROKES, not raw miss events (v107): the recognizer
  // often rejects a correct second attempt at the same stroke, and the
  // owner shouldn't pay twice for one mistake.
  const wrongStrokes = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    try {
      void Promise.resolve(window.HanziWriter?.loadCharacterData?.(char))
        .then((data) => {
          if (!cancelled && data?.strokes?.length) setStrokeCount(data.strokes.length);
        })
        .catch(() => {});
    } catch {
      /* no HanziWriter global — score falls back */
    }
    return () => {
      cancelled = true;
    };
  }, [char]);

  const meaning = (charData?.definitions || []).slice(0, 2).join("; ");
  const pinyin = charData?.pinyin || "";

  // Speak the prompt when the drill mounts so the user knows what to
  // write, and stop any pending speech on unmount.
  useEffect(() => {
    autoSpeak(char);
    return () => stopSpeech();
  }, [char]);

  const advance = () => {
    if (!done) return;
    onScore(productionScore(strokeCount, done.mistakes));
  };

  return (
    <div
      className={`phonetic-tap${done ? " is-tappable" : ""}`}
      onClick={done ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="production-prompt">
          <div className="production-prompt-pinyin">{pinyin}</div>
          <div className="production-prompt-gloss">{meaning || "(no gloss)"}</div>
        </div>
        <HanziGlyph
          char={char}
          mode="quiz"
          maxSize={280}
          padding={6}
          className="production-writer"
          ariaLabel={`Trace ${char}`}
          onMistake={(_total, strokeNum) => {
            wrongStrokes.current.add(strokeNum);
            setMistakes(wrongStrokes.current.size);
          }}
          onComplete={() => setDone({ mistakes: wrongStrokes.current.size })}
          onError={(msg) => setError(msg)}
        />
        {error && <div className="phonetic-tap-feedback is-wrong">{error}</div>}
        {!done && (
          <div className="production-status">
            {mistakes === 0 ? "Trace each stroke in order." : `Mistakes: ${mistakes}`}
          </div>
        )}
        {done && (
          <>
            <div className="phonetic-tap-feedback is-correct">
              {done.mistakes === 0
                ? "Perfect — no mistakes."
                : `${done.mistakes} mistake${done.mistakes === 1 ? "" : "s"}.`}
            </div>
            {onOpenEntity && (
              <button
                type="button"
                className="production-explore is-explorable"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEntity(char);
                }}
              >
                {char} · explore →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
