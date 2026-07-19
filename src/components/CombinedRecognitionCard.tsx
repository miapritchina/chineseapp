import { useEffect, useRef, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { GradeButtons } from "./ui/GradeButtons";
import { Entity } from "./Entity";

interface Props {
  itemKey: string;
  itemKind: "word" | "char" | "component";
  word: Word | null;
  charData: Char | undefined;
  // ONE grade covers both facets (v102): "when I see the character I
  // answer how well I remember sound AND meaning at the same time".
  // The parent applies the rating to both FSRS rows.
  onGrade: (rating: RatingName) => void;
  onSkip: () => void;
}

// Recognition card. Tap anywhere to reveal (pinyin + meaning + audio),
// then ONE Again/Good/Easy row grades the item and advances
// immediately — no second grade row, no extra tap-to-continue.
export function CombinedRecognitionCard({ itemKey, word, charData, onGrade, onSkip }: Props) {
  const [revealed, setRevealed] = useState(false);
  // Guard against double-taps firing two grades for the same card.
  const gradedRef = useRef(false);

  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const gloss = word
    ? (word.definitions || []).slice(0, 3).join("; ")
    : (charData?.definitions || []).slice(0, 3).join("; ");

  // Speak the answer on reveal. Stop pending speech on unmount.
  useEffect(() => {
    if (!revealed) return;
    speak(itemKey);
  }, [revealed, itemKey]);
  useEffect(() => () => stopSpeech(), []);

  const handleGrade = (rating: RatingName) => {
    if (gradedRef.current) return;
    gradedRef.current = true;
    onGrade(rating);
  };

  // Swipe-to-grade (2B): after reveal, a horizontal swipe grades —
  // right → Good, left → Again. Buttons stay for Easy.
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
    handleGrade(dx > 0 ? "Good" : "Again");
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
              <div className="combined-grade-row">
                <GradeButtons onPick={handleGrade} />
              </div>
            </div>
          </>
        )}
        {/* Skip is only available BEFORE reveal. */}
        {!revealed && (
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
