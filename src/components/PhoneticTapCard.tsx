import { useEffect, useMemo, useRef, useState } from "react";
import type { Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";

interface Props {
  char: string;
  charData: Char;
  // PR 4 grade contract: tap correct → "Good", tap wrong → "Again".
  // No Easy on this drill (binary correct/incorrect).
  onGrade: (rating: RatingName) => void;
}

// Drill: "Tap the part that gives the sound."
//
// Shows the parent character + a row of its direct components as chips.
// User taps one. Correct = the component whose role is "sound". Reveal
// the right answer for ~1 s, then auto-grade and let the parent advance.
//
// Cheapest, highest-leverage prompt per the rollout brief — directly
// trains the perceptual skill L2 readers underuse (Williams & Bever).
//
// Caller is responsible for guaranteeing charData has a sound component.
// If it doesn't, ReviewPage's parent loading/skip path is the right
// surface — never auto-skip here (that was the source of the queue-
// flipping bug).
export function PhoneticTapCard({ char, charData, onGrade }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  const components = useMemo(
    () => (charData.components || []).filter((c) => c.char && c.char !== "◎"),
    [charData],
  );
  const correct = useMemo(
    () => components.find((c) => c.type === "sound") ?? null,
    [components],
  );

  const correctChar = correct?.char ?? null;
  const isCorrect = picked !== null && picked === correctChar;
  const isWrong = picked !== null && picked !== correctChar;

  // Auto-grade once per pick. The timer key is `picked`; we capture
  // onGrade in a ref so changes to its identity (parent re-renders) don't
  // restart the timer.
  const onGradeRef = useRef(onGrade);
  useEffect(() => {
    onGradeRef.current = onGrade;
  }, [onGrade]);
  useEffect(() => {
    if (picked === null) return;
    const willBeCorrect = picked === correctChar;
    const t = window.setTimeout(
      () => onGradeRef.current(willBeCorrect ? "Good" : "Again"),
      willBeCorrect ? 700 : 1500,
    );
    return () => window.clearTimeout(t);
  }, [picked, correctChar]);

  if (!correctChar) {
    // Shouldn't happen — caller guarantees the data is present. Render
    // an inert placeholder rather than auto-skipping (see big comment
    // above).
    return (
      <div className="phonetic-tap">
        <div className="phonetic-tap-prompt">No sound component for {char}.</div>
      </div>
    );
  }

  return (
    <div className="phonetic-tap">
      <div className="phonetic-tap-prompt">Tap the part that gives the sound.</div>
      <div className="phonetic-tap-glyph">{char}</div>
      {charData.pinyin && (
        <div className="phonetic-tap-pinyin">{charData.pinyin}</div>
      )}
      <div className="phonetic-tap-row">
        {components.map((c) => {
          const isThisCorrect = c.char === correctChar;
          const isPicked = picked === c.char;
          const cls = ["phonetic-tap-pick"];
          if (isPicked && isCorrect) cls.push("is-correct");
          if (isPicked && isWrong) cls.push("is-wrong");
          if (isWrong && isThisCorrect) cls.push("is-reveal");
          return (
            <button
              key={c.char}
              type="button"
              className={cls.join(" ")}
              disabled={picked !== null}
              onClick={() => setPicked(c.char)}
            >
              <span className="phonetic-tap-pick-char">{c.char}</span>
              {(isPicked || (isWrong && isThisCorrect)) && c.pinyin && (
                <span className="phonetic-tap-pick-pinyin">{c.pinyin}</span>
              )}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className={`phonetic-tap-feedback${isCorrect ? " is-correct" : " is-wrong"}`}>
          {isCorrect
            ? "Right — sound component."
            : `Sound was ${correctChar}${correct?.pinyin ? ` (${correct.pinyin})` : ""}.`}
        </div>
      )}
    </div>
  );
}
