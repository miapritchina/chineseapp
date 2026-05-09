import { useEffect, useMemo, useState } from "react";
import type { RatingName } from "../lib/fsrs";
import type { Char } from "../lib/types";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { firstReading, speak } from "../lib/speech";

interface Props {
  // The family-member char being tested (the new char the user hasn't
  // formally saved yet).
  familyMember: string;
  // Char data for the member, looked up in data-chars.json.
  charData: Char | undefined;
  // The phonetic component this member belongs to. Used to phrase the
  // prompt: "You know <component> = <pinyin>; what about <member>?".
  // Picked by the parent (ReviewPage) by walking phoneticComponentsByChar.
  componentEntry: PhoneticComponent;
  // Distractor pool for the multi-choice answers.
  pool: PhoneticComponent[];
  onGrade: (rating: RatingName) => void;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

interface Choice {
  match: string;
  display: string;
}

// Drill: "If 青 = qīng, what about 情?"
//
// The question primes the user with a known phonetic component, then asks
// for the pinyin of an un-encountered family member. Often the right
// answer is the same syllable; sometimes drift makes it different. Either
// way, the drill is the explicit youbian-dubian skill from the brief.
//
// Auto-grades on pick (Good/Again). Tap-anywhere-to-continue wired in
// at the parent (ReviewPage).
export function FamilyTransferCard({
  familyMember,
  charData,
  componentEntry,
  pool,
  onGrade,
}: Props) {
  const [picked, setPicked] = useState<string | null>(null);

  // Tone-free pinyin of the family member is the correct answer.
  const correctPinyin = useMemo(() => {
    const raw = charData?.pinyin || "";
    return firstReading(raw)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }, [charData]);
  const correctDisplay = firstReading(charData?.pinyin || "") || correctPinyin;

  const choices = useMemo<Choice[]>(() => {
    const distractorPool = pool.filter(
      (c) => c.pinyin && c.pinyin !== correctPinyin && c.char !== familyMember,
    );
    const seed = hash(familyMember);
    const arr = distractorPool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (seed + i * 2654435761) % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    const distractors: Choice[] = [];
    const seen = new Set<string>([correctPinyin]);
    for (const c of arr) {
      if (seen.has(c.pinyin)) continue;
      seen.add(c.pinyin);
      distractors.push({
        match: c.pinyin,
        display: firstReading(c.pinyinTones) || c.pinyin,
      });
      if (distractors.length === 3) break;
    }
    const slots: Choice[] = [
      ...distractors,
      { match: correctPinyin, display: correctDisplay },
    ];
    for (let i = slots.length - 1; i > 0; i--) {
      const j = (seed + i * 1597334677) % (i + 1);
      const tmp = slots[i];
      slots[i] = slots[j];
      slots[j] = tmp;
    }
    return slots;
  }, [familyMember, correctPinyin, correctDisplay, pool]);

  const isCorrect = picked !== null && picked === correctPinyin;
  const isWrong = picked !== null && picked !== correctPinyin;

  // No timer. Speak the family member's pronunciation after pick (the
  // answer in audio form). Parent handles tap-to-advance.
  useEffect(() => {
    if (picked === null) return;
    speak(familyMember);
  }, [picked, familyMember]);

  const advanceWithGrade = () => {
    if (picked === null) return;
    onGrade(picked === correctPinyin ? "Good" : "Again");
  };

  // Defensive: if charData is missing the pinyin for some reason, render
  // an inert message so the parent's Skip path is the only out.
  if (!correctPinyin) {
    return (
      <div className="phonetic-tap">
        <div className="phonetic-tap-inner">
          <div className="phonetic-tap-prompt">
            No pinyin data for {familyMember}.
          </div>
        </div>
      </div>
    );
  }

  // Sound-component fallback for the prompt label.
  const componentDisplay = firstReading(componentEntry.pinyinTones) || componentEntry.pinyin;

  return (
    <div
      className={`phonetic-tap${picked !== null ? " is-tappable" : ""}`}
      onClick={picked !== null ? advanceWithGrade : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">
          You know {componentEntry.char} = {componentDisplay}.
        </div>
        <div className="family-transfer-question">
          What about <span className="family-transfer-target">{familyMember}</span>?
        </div>
        <div className="phonetic-tap-row">
          {choices.map((c) => {
            const isThisCorrect = c.match === correctPinyin;
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
        {isWrong && (
          <div className="phonetic-tap-feedback is-wrong">
            {familyMember} = {correctDisplay}
          </div>
        )}
        {picked !== null && (
          <div className="drill-tap-hint">Tap anywhere to continue →</div>
        )}
      </div>
    </div>
  );
}
