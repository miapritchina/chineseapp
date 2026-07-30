import { useEffect, useRef, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { autoSpeak, speak, stopSpeech } from "../lib/speech";
import { useResolvedDefs } from "../hooks/useResolvedDefs";
import { GradeButtons } from "./ui/GradeButtons";
import { Entity } from "./Entity";

interface Props {
  itemKey: string;
  itemKind: "word" | "char" | "component";
  word: Word | null;
  charData: Char | undefined;
  // ONE card, TWO answers (v105): the user grades meaning and sound
  // separately on the same reveal. Reported together once both are
  // picked; the parent applies each to its FSRS row.
  onGraded: (meaning: RatingName, sound: RatingName) => void;
  // Open the EntitySheet for the focal item (post-reveal).
  onOpenEntity?: (key: string) => void;
}

// Recognition card. Tap anywhere to reveal (pinyin + meaning + audio),
// then grade Meaning and Sound in either order — the card advances the
// moment the second row is picked, no extra tap. A horizontal swipe is
// the fast path: it applies one rating to BOTH rows (right → Good,
// left → Again).
export function CombinedRecognitionCard({
  itemKey,
  word,
  charData,
  onGraded,
  onOpenEntity,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [meaningGrade, setMeaningGrade] = useState<RatingName | null>(null);
  const [soundGrade, setSoundGrade] = useState<RatingName | null>(null);
  // Guard against double-taps firing two advances for the same card.
  const gradedRef = useRef(false);

  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const defs = useResolvedDefs(word ? word.definitions || [] : charData?.definitions || []);
  const gloss = defs.slice(0, 3).join("; ");

  // Speak the answer on reveal. Stop pending speech on unmount.
  useEffect(() => {
    if (!revealed) return;
    autoSpeak(itemKey);
  }, [revealed, itemKey]);
  useEffect(() => () => stopSpeech(), []);

  const finish = (meaning: RatingName, sound: RatingName) => {
    if (gradedRef.current) return;
    gradedRef.current = true;
    onGraded(meaning, sound);
  };
  const pickMeaning = (r: RatingName) => {
    setMeaningGrade(r);
    if (soundGrade) finish(r, soundGrade);
  };
  const pickSound = (r: RatingName) => {
    setSoundGrade(r);
    if (meaningGrade) finish(meaningGrade, r);
  };

  // Swipe-to-grade (2B): after reveal, a horizontal swipe grades both
  // rows at once — right → Good, left → Again. Buttons let you split.
  const SWIPE_MIN = 60;
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (!revealed) {
      swipeStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || !revealed) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const rating: RatingName = dx > 0 ? "Good" : "Again";
    setMeaningGrade(rating);
    setSoundGrade(rating);
    finish(rating, rating);
  };

  return (
    <div
      className="combined-card-surface"
      onClick={!revealed ? () => setRevealed(true) : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!revealed && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          setRevealed(true);
        }
      }}
      aria-label={revealed ? "Card revealed" : "Tap anywhere to reveal"}
    >
      <div className="combined-card-stack">
        <Entity
          itemKey={itemKey}
          size="hero"
          showPinyin={false}
          showMeaning={false}
          ariaLabel={itemKey}
          // Post-reveal the answer is out — tapping the glyph opens
          // its sheet for exploring (pre-reveal it stays inert so the
          // tap-anywhere reveal keeps working).
          onTap={revealed && onOpenEntity ? () => onOpenEntity(itemKey) : undefined}
        />
        {!revealed && <div className="review-tap-hint">Tap anywhere to reveal</div>}
        {revealed && (
          <>
            <div className="review-pinyin review-pinyin-lg">{pinyin}</div>
            <div className="review-gloss">{gloss || "(no dictionary entry)"}</div>
            <button
              type="button"
              className="review-tap-replay combined-replay"
              onClick={(e) => {
                e.stopPropagation();
                speak(itemKey);
              }}
            >
              🔊 replay
            </button>
            <div className="combined-grade-block">
              <div className="combined-grade-label">Meaning</div>
              <div className="combined-grade-row">
                <GradeButtons picked={meaningGrade} onPick={pickMeaning} />
              </div>
            </div>
            <div className="combined-grade-block">
              <div className="combined-grade-label">Sound</div>
              <div className="combined-grade-row">
                <GradeButtons picked={soundGrade} onPick={pickSound} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
