import { useEffect, useRef, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { GradeButtons } from "./ui/GradeButtons";
import { Entity } from "./Entity";

const CONTINUE_HINT_KEY = "hint.seen.review-continue";
function hintAlreadySeen(): boolean {
  try {
    return !!sessionStorage.getItem(CONTINUE_HINT_KEY);
  } catch {
    return false;
  }
}

interface Props {
  itemKey: string;
  itemKind: "word" | "char" | "component";
  word: Word | null;
  charData: Char | undefined;
  onGradeMeaning: (rating: RatingName) => void;
  onGradeSound: (rating: RatingName) => void;
  onSkip: () => void;
  hasMeaningCard: boolean;
  hasSoundCard: boolean;
}

// Combined recognition card. Replaces the v66 split (separate meaning +
// sound cards). Tap-anywhere-on-screen to reveal. After reveal, audio
// plays + both pinyin + meaning are visible. User grades the meaning
// AND the sound (separate rows). Once both are picked, tap-anywhere
// fires both grade callbacks and advances. Skip is only available
// before the user picks anything.
export function CombinedRecognitionCard({
  itemKey,
  word,
  charData,
  onGradeMeaning,
  onGradeSound,
  onSkip,
  hasMeaningCard,
  hasSoundCard,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [meaningGrade, setMeaningGrade] = useState<RatingName | null>(null);
  const [soundGrade, setSoundGrade] = useState<RatingName | null>(null);
  // "Tap anywhere to continue →" shows once per session, then fades after
  // 2s and never reappears (UX-2).
  const seenContinueRef = useRef(hintAlreadySeen());
  const [hideContinueHint, setHideContinueHint] = useState(seenContinueRef.current);

  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const gloss = word
    ? (word.definitions || []).slice(0, 3).join("; ")
    : (charData?.definitions || []).slice(0, 3).join("; ");

  // If only one of the two recognition facets exists for this item
  // (e.g. legacy data, or seeded mid-rollout), only ask about that
  // dimension and short-circuit the other. This is the tap-once advance
  // case in disguise.
  const meaningRequired = hasMeaningCard;
  const soundRequired = hasSoundCard;

  // Speak the answer on reveal. Stop pending speech on unmount.
  useEffect(() => {
    if (!revealed) return;
    speak(itemKey);
  }, [revealed, itemKey]);
  useEffect(() => () => stopSpeech(), []);

  const allGraded =
    (!meaningRequired || meaningGrade !== null) && (!soundRequired || soundGrade !== null);

  useEffect(() => {
    if (!revealed || !allGraded || hideContinueHint) return;
    const t = window.setTimeout(() => {
      setHideContinueHint(true);
      try {
        sessionStorage.setItem(CONTINUE_HINT_KEY, "1");
      } catch {
        /* ignore */
      }
      seenContinueRef.current = true;
    }, 2000);
    return () => window.clearTimeout(t);
  }, [revealed, allGraded, hideContinueHint]);

  const handleAnywhereClick = () => {
    if (!revealed) {
      setRevealed(true);
      return;
    }
    if (allGraded) {
      if (meaningRequired && meaningGrade) onGradeMeaning(meaningGrade);
      if (soundRequired && soundGrade) onGradeSound(soundGrade);
    }
  };

  // Swipe-to-grade (2B): after reveal, a horizontal swipe sets both
  // grades — right → Good, left → Again. Buttons stay for Hard/Easy.
  // (≥ 60px horizontal travel, and mostly horizontal.)
  const SWIPE_MIN = 60;
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (!revealed || allGraded) {
      swipeStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || !revealed || allGraded) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const rating: RatingName = dx > 0 ? "Good" : "Again";
    if (meaningRequired) setMeaningGrade(rating);
    if (soundRequired) setSoundGrade(rating);
  };

  return (
    <div
      className="combined-card-surface"
      onClick={handleAnywhereClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleAnywhereClick();
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
          </>
        )}
        {revealed && meaningRequired && (
          <div className="combined-grade-block">
            <div className="combined-grade-label">Meaning</div>
            <div className="combined-grade-row">
              {/* locked once both facets are graded: clicks then bubble
                  to the tap-anywhere-to-advance surface instead of
                  re-recording a grade. */}
              <GradeButtons picked={meaningGrade} locked={allGraded} onPick={setMeaningGrade} />
            </div>
          </div>
        )}
        {revealed && soundRequired && (
          <div className="combined-grade-block">
            <div className="combined-grade-label">Sound</div>
            <div className="combined-grade-row">
              <GradeButtons picked={soundGrade} locked={allGraded} onPick={setSoundGrade} />
            </div>
          </div>
        )}
        {revealed && allGraded && !hideContinueHint && (
          <div className="drill-tap-hint">Tap anywhere to continue →</div>
        )}
        {/* Skip is only available BEFORE the user picks anything. After
            reveal or any grade, it disappears (per the new UX rule). */}
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
