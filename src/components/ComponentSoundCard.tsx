import { useEffect, useMemo, useState } from "react";
import type { RatingName } from "../lib/fsrs";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { firstReading, speak, stopSpeech } from "../lib/speech";

interface Props {
  // The component to test.
  entry: PhoneticComponent;
  // Distractor pool — other phonetic components, sampled for plausible
  // wrong answers.
  pool: PhoneticComponent[];
  onGrade: (rating: RatingName) => void;
}

// Deterministic hash → small integer, used for stable distractor sampling
// per-component so the user sees the same distractors on review.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

interface Choice {
  // Tone-free key — used for match correctness ("we don't test tone").
  match: string;
  // Tone-marked label, what the user reads on the button.
  display: string;
}

// Drill: "What sound does this component give?"
//
// Show the component glyph + four pinyin choices. Tap the right one.
// Choices show tone marks; matching is tone-free (per the brief — defer
// tone training, recognize the syllable). Auto-grades Good / Again.
//
// Audio: zh-CN TTS plays the component's pinyin on first render and
// again on reveal. Tap the glyph to replay anytime.
export function ComponentSoundCard({ entry, pool, onGrade }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  const choices = useMemo<Choice[]>(() => {
    const distractorPool = pool.filter(
      (c) => c.pinyin && c.pinyin !== entry.pinyin && c.char !== entry.char,
    );
    const seed = hash(entry.char);
    // Stable shuffle so the same component always shows the same options.
    const arr = distractorPool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (seed + i * 2654435761) % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    const distractors: Choice[] = [];
    const seen = new Set<string>([entry.pinyin]);
    for (const c of arr) {
      if (seen.has(c.pinyin)) continue;
      seen.add(c.pinyin);
      distractors.push({
        match: c.pinyin,
        display: firstReading(c.pinyinTones) || c.pinyin,
      });
      if (distractors.length === 3) break;
    }
    const correctChoice: Choice = {
      match: entry.pinyin,
      display: firstReading(entry.pinyinTones) || entry.pinyin,
    };
    const slots: Choice[] = [...distractors, correctChoice];
    for (let i = slots.length - 1; i > 0; i--) {
      const j = (seed + i * 1597334677) % (i + 1);
      const tmp = slots[i];
      slots[i] = slots[j];
      slots[j] = tmp;
    }
    return slots;
  }, [entry, pool]);

  const isCorrect = picked !== null && picked === entry.pinyin;
  const isWrong = picked !== null && picked !== entry.pinyin;

  // Speak the component AFTER the user has picked — playing it before
  // would just be the answer in audio form. No timer: user taps to
  // advance.
  useEffect(() => {
    if (picked === null) return;
    speak(entry.char);
  }, [picked, entry.char]);
  useEffect(() => () => stopSpeech(), []);

  const advanceWithGrade = () => {
    if (picked === null) return;
    onGrade(picked === entry.pinyin ? "Good" : "Again");
  };

  return (
    <div
      className={`phonetic-tap${picked !== null ? " is-tappable" : ""}`}
      onClick={picked !== null ? advanceWithGrade : undefined}
    >
     <div className="phonetic-tap-inner">
      <div className="phonetic-tap-prompt">What sound does this give?</div>
      <button
        type="button"
        className="phonetic-tap-glyph-btn"
        aria-label={`Play ${entry.char}`}
        onClick={(e) => {
          e.stopPropagation();
          speak(entry.char);
        }}
      >
        <span className="phonetic-tap-glyph">{entry.char}</span>
        {picked !== null && (
          <span className="phonetic-tap-speaker" aria-hidden="true">🔊</span>
        )}
      </button>
      <div className="phonetic-tap-row">
        {choices.map((c) => {
          const isThisCorrect = c.match === entry.pinyin;
          const isPicked = picked === c.match;
          const cls = ["phonetic-tap-pick"];
          if (isPicked && isCorrect) cls.push("is-correct");
          if (isPicked && isWrong) cls.push("is-wrong");
          if (isWrong && isThisCorrect) cls.push("is-reveal");
          return (
            <button
              key={c.match}
              type="button"
              className={cls.join(" ")}
              disabled={picked !== null}
              onClick={(e) => {
                e.stopPropagation();
                setPicked(c.match);
              }}
            >
              <span className="phonetic-tap-pick-pinyin component-sound-pinyin">
                {c.display}
              </span>
            </button>
          );
        })}
      </div>
      {/* Wrong-answer feedback only — the right-answer is already obvious
          from the green chip + the audio playback. */}
      {isWrong && (
        <div className="phonetic-tap-feedback is-wrong">
          {entry.char} = {firstReading(entry.pinyinTones) || entry.pinyin}
        </div>
      )}
      {picked !== null && (
        <div className="drill-tap-hint">Tap anywhere to continue →</div>
      )}
     </div>
    </div>
  );
}
