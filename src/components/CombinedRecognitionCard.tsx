import { useEffect, useRef, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { hanziScaleStyle } from "../lib/hanzi";

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

const RATINGS: RatingName[] = ["Again", "Good", "Easy"];
const RATING_LABEL: Record<RatingName, string> = {
  Again: "Again",
  Good: "Good",
  Easy: "Easy",
  Hard: "Hard",
};
const RATING_CLS: Record<RatingName, string> = {
  Again: "review-btn-again",
  Good: "review-btn-good",
  Easy: "review-btn-easy",
  Hard: "review-btn-skip",
};

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
    (!meaningRequired || meaningGrade !== null) &&
    (!soundRequired || soundGrade !== null);

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

  return (
    <div
      className="combined-card-surface"
      onClick={handleAnywhereClick}
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
        <div className="review-hanzi" style={hanziScaleStyle(itemKey)}>{itemKey}</div>
        {!revealed && (
          <div className="review-tap-hint">Tap anywhere to reveal</div>
        )}
        {revealed && (
          <>
            <div className="review-pinyin review-pinyin-lg">{pinyin}</div>
            <div className="review-gloss">
              {gloss || "(no dictionary entry)"}
            </div>
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
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`review-btn ${RATING_CLS[r]}${meaningGrade === r ? " is-picked" : ""}`}
                  onClick={(e) => {
                    // Once both grades are picked, ANY click should
                    // advance the queue — let propagation bubble up to
                    // the outer surface. Otherwise eat the click and
                    // record the grade.
                    if (allGraded) return;
                    e.stopPropagation();
                    setMeaningGrade(r);
                  }}
                >
                  {RATING_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
        )}
        {revealed && soundRequired && (
          <div className="combined-grade-block">
            <div className="combined-grade-label">Sound</div>
            <div className="combined-grade-row">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`review-btn ${RATING_CLS[r]}${soundGrade === r ? " is-picked" : ""}`}
                  onClick={(e) => {
                    if (allGraded) return;
                    e.stopPropagation();
                    setSoundGrade(r);
                  }}
                >
                  {RATING_LABEL[r]}
                </button>
              ))}
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
