import { useEffect, useMemo, useState } from "react";
import type { Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";

interface Props {
  char: string;
  charData: Char | undefined;
  // PR 4 grade contract: tap correct → "Good", tap wrong → "Again".
  // No Easy on this drill (binary correct/incorrect).
  onGrade: (rating: RatingName) => void;
  onSkip: () => void;
}

// Drill: "Tap the part that gives the sound."
//
// Shows the parent character + a row of its direct components as chips.
// User taps one. Correct = the component whose role is "sound". On tap
// we reveal the right answer (and short hint) for ~1.5 s, then auto-grade
// and advance.
//
// Cheapest, highest-leverage prompt per the rollout brief — directly
// trains the perceptual skill L2 readers underuse (Williams & Bever).
export function PhoneticTapCard({ char, charData, onGrade, onSkip }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  // Components in display order; filter out the empty-marker ◎.
  const components = useMemo(
    () => (charData?.components || []).filter((c) => c.char && c.char !== "◎"),
    [charData],
  );
  const correct = useMemo(
    () => components.find((c) => c.type === "sound") ?? null,
    [components],
  );

  const correctChar = correct?.char ?? null;
  const isCorrect = picked !== null && picked === correctChar;
  const isWrong = picked !== null && picked !== correctChar;

  // No sound component in the data → drill can't run; skip cleanly.
  // Hook-order safe: this effect is unconditional, but only fires the
  // callback when the data is actually missing.
  useEffect(() => {
    if (correctChar === null) onSkip();
  }, [correctChar, onSkip]);

  // Auto-advance after a short reveal so the drill feels snappy.
  useEffect(() => {
    if (picked === null) return;
    const t = window.setTimeout(
      () => onGrade(isCorrect ? "Good" : "Again"),
      isCorrect ? 700 : 1500,
    );
    return () => window.clearTimeout(t);
  }, [picked, isCorrect, onGrade]);

  if (!correctChar) return null;

  return (
    <div className="phonetic-tap">
      <div className="phonetic-tap-prompt">Tap the part that gives the sound.</div>
      <div className="phonetic-tap-glyph">{char}</div>
      {charData?.pinyin && (
        <div className="phonetic-tap-pinyin">{charData.pinyin}</div>
      )}
      <div className="phonetic-tap-row">
        {components.map((c) => {
          const isThisCorrect = c.char === correctChar;
          const isPicked = picked === c.char;
          const cls = ["phonetic-tap-pick"];
          if (isPicked && isCorrect) cls.push("is-correct");
          if (isPicked && isWrong) cls.push("is-wrong");
          // Reveal the correct one when the user picked wrong.
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
