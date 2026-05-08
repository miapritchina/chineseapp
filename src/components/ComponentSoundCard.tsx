import { useEffect, useMemo, useRef, useState } from "react";
import type { RatingName } from "../lib/fsrs";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";

interface Props {
  // The component to test.
  entry: PhoneticComponent;
  // Distractor pool — other phonetic components, sampled for plausible
  // wrong answers (different syllables, similar familiarity).
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

// Drill: "What sound does this component give?"
// Show the component glyph + 4 tone-free pinyin choices. Tap the right
// one. Auto-grades Good / Again — same UX as the phonetic-tap drill.
export function ComponentSoundCard({ entry, pool, onGrade }: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  // Build the choice set: correct + 3 distractors. Sample by hash so it's
  // stable per component and easy to test.
  const choices = useMemo(() => {
    const distractorPool = pool.filter(
      (c) => c.pinyin && c.pinyin !== entry.pinyin && c.char !== entry.char,
    );
    const seed = hash(entry.char);
    // Fisher-Yates with hash-derived stride.
    const arr = distractorPool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (seed + i * 2654435761) % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    const distractors: string[] = [];
    const seen = new Set<string>([entry.pinyin]);
    for (const c of arr) {
      if (seen.has(c.pinyin)) continue;
      seen.add(c.pinyin);
      distractors.push(c.pinyin);
      if (distractors.length === 3) break;
    }
    const slots: string[] = [...distractors, entry.pinyin];
    // Stable shuffle of the four with the same seed so the correct slot
    // doesn't always land last.
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

  // Auto-grade once per pick. onGrade lives in a ref so its identity
  // changes from parent re-renders don't restart the timer (which used
  // to fire onGrade for the wrong card after a queue shift).
  const onGradeRef = useRef(onGrade);
  useEffect(() => {
    onGradeRef.current = onGrade;
  }, [onGrade]);
  useEffect(() => {
    if (picked === null) return;
    const willBeCorrect = picked === entry.pinyin;
    const t = window.setTimeout(
      () => onGradeRef.current(willBeCorrect ? "Good" : "Again"),
      willBeCorrect ? 700 : 1500,
    );
    return () => window.clearTimeout(t);
  }, [picked, entry.pinyin]);

  return (
    <div className="phonetic-tap">
      <div className="phonetic-tap-prompt">What sound does this give?</div>
      <div className="phonetic-tap-glyph">{entry.char}</div>
      <div className="phonetic-tap-row">
        {choices.map((p) => {
          const isThisCorrect = p === entry.pinyin;
          const isPicked = picked === p;
          const cls = ["phonetic-tap-pick"];
          if (isPicked && isCorrect) cls.push("is-correct");
          if (isPicked && isWrong) cls.push("is-wrong");
          if (isWrong && isThisCorrect) cls.push("is-reveal");
          return (
            <button
              key={p}
              type="button"
              className={cls.join(" ")}
              disabled={picked !== null}
              onClick={() => setPicked(p)}
            >
              <span className="phonetic-tap-pick-pinyin component-sound-pinyin">{p}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className={`phonetic-tap-feedback${isCorrect ? " is-correct" : " is-wrong"}`}>
          {isCorrect
            ? `Right — ${entry.char} = ${entry.pinyin}.`
            : `${entry.char} = ${entry.pinyin}.`}
        </div>
      )}
      {entry.pinyinTones && entry.pinyinTones !== entry.pinyin && picked !== null && (
        <div className="component-sound-tones">{entry.pinyinTones}</div>
      )}
    </div>
  );
}
