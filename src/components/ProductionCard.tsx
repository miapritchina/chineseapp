import { useEffect, useState } from "react";
import type { Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { HanziGlyph } from "./ui/HanziGlyph";

interface Props {
  char: string;
  charData: Char | undefined;
  // Auto-grade: Easy = no mistakes, Good ≤ 2 mistakes, Again > 2.
  // Caller decides what to do with the rating; advance happens via the
  // tap-anywhere overlay after the quiz completes.
  onGrade: (rating: RatingName) => void;
  onSkip: () => void;
}

// Production drill — "write the character that means X." Reveals the
// meaning + pinyin as the prompt, then the user traces the strokes via
// <HanziGlyph mode="quiz">. Auto-grades on completion based on stroke
// mistakes; manual Skip available before the user starts tracing.
export function ProductionCard({ char, charData, onGrade, onSkip }: Props) {
  const [done, setDone] = useState<{ mistakes: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const meaning = (charData?.definitions || []).slice(0, 2).join("; ");
  const pinyin = charData?.pinyin || "";

  // Speak the prompt when the drill mounts so the user knows what to
  // write, and stop any pending speech on unmount.
  useEffect(() => {
    speak(char);
    return () => stopSpeech();
  }, [char]);

  const grade = (): RatingName => {
    const m = done?.mistakes ?? 0;
    if (m === 0) return "Easy";
    if (m <= 2) return "Good";
    return "Again";
  };

  const advance = () => {
    if (!done) return;
    onGrade(grade());
  };

  return (
    <div
      className={`phonetic-tap${done ? " is-tappable" : ""}`}
      onClick={done ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Write the character that means…</div>
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
          onMistake={setMistakes}
          onComplete={(m) => setDone({ mistakes: m })}
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
            <div className="drill-tap-hint">Tap anywhere to continue →</div>
          </>
        )}
        {!done && (
          <button
            type="button"
            className="review-btn review-btn-skip combined-skip"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
