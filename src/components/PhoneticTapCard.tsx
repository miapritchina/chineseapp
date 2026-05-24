import { useEffect, useMemo, useState } from "react";
import type { Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { Entity } from "./Entity";

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

  const baseComponents = useMemo(
    () => (charData.components || []).filter((c) => c.char && c.char !== "◎"),
    [charData],
  );
  const correct = useMemo(
    () => baseComponents.find((c) => c.type === "sound") ?? null,
    [baseComponents],
  );

  // Shuffle the chip order ONCE on mount. Natural data order in
  // data-chars.json puts the phonetic on the right for most phono-
  // semantic compounds, so without this the user just learns "tap the
  // rightmost." Re-shuffles next time the drill mounts (i.e. on the
  // card's next surfacing). Stable per mount so the chips don't shift
  // mid-tap.
  const [components] = useState(() => {
    const arr = baseComponents.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  });

  const correctChar = correct?.char ?? null;
  const isCorrect = picked !== null && picked === correctChar;
  const isWrong = picked !== null && picked !== correctChar;

  // Speak the correct sound component on reveal. No timer — the user
  // taps to continue (per their preference) rather than auto-advancing.
  useEffect(() => {
    if (picked === null) return;
    if (correctChar) speak(correctChar);
  }, [picked, correctChar]);

  // Speak the parent character on mount.
  useEffect(() => {
    speak(char);
    return () => stopSpeech();
  }, [char]);

  const advanceWithGrade = () => {
    if (picked === null) return;
    onGrade(picked === correctChar ? "Good" : "Again");
  };

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
    <div
      className={`phonetic-tap${picked !== null ? " is-tappable" : ""}`}
      onClick={picked !== null ? advanceWithGrade : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Tap the part that gives the sound.</div>
        <button
          type="button"
          className="phonetic-tap-glyph-btn"
          aria-label={`Play ${char}`}
          onClick={(e) => {
            e.stopPropagation();
            speak(char);
          }}
        >
          <span className="phonetic-tap-glyph">{char}</span>
          <span className="phonetic-tap-speaker" aria-hidden="true">
            🔊
          </span>
        </button>
        {charData.pinyin && <div className="phonetic-tap-pinyin">{charData.pinyin}</div>}
        <div className="phonetic-tap-row">
          {components.map((c) => {
            const isThisCorrect = c.char === correctChar;
            const isPicked = picked === c.char;
            const showReveal = isWrong && isThisCorrect;
            const flash =
              isPicked && isCorrect
                ? "is-correct"
                : isPicked && isWrong
                  ? "is-wrong"
                  : showReveal
                    ? "is-reveal"
                    : "";
            return (
              <Entity
                key={c.char}
                itemKey={c.char}
                size="tiny"
                showPinyin={isPicked || showReveal}
                showMeaning={false}
                ariaLabel={c.char}
                className={`phonetic-tap-pick ${flash}`.trim()}
                onTap={picked === null ? () => setPicked(c.char) : undefined}
              />
            );
          })}
        </div>
        {/* Wrong-answer feedback only — the chip's green border is enough on
          its own when the user got it right (the redundant "Right —"
          line was distracting). */}
        {isWrong && correct && (
          <div className="phonetic-tap-feedback is-wrong">
            Sound: {correctChar}
            {correct.pinyin ? ` · ${correct.pinyin}` : ""}
          </div>
        )}
        {picked !== null && <div className="drill-tap-hint">Tap anywhere to continue →</div>}
      </div>
    </div>
  );
}
