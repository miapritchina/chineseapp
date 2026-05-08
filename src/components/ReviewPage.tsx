import { useState } from "react";
import type { Word } from "../lib/types";
import type { ReviewCard } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";

interface Props {
  dueCards: ReviewCard[];
  findWord: (key: string) => Word | null;
  ensureCached: (keys: string[]) => Promise<void>;
  onGrade: (itemKey: string, rating: RatingName) => void;
  onClose: () => void;
}

// First-PR drill: recognition. Show the hanzi, tap to reveal pinyin +
// definitions, then grade Again / Good / Easy. Hard is omitted on
// purpose (Anki's most-debated grade; one fewer decision per card).
export function ReviewPage({ dueCards, findWord, ensureCached, onGrade, onClose }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);

  const total = dueCards.length;
  const current = dueCards[index];

  // Hydrate the next few words so reveal is instant.
  if (current) {
    const window = dueCards.slice(index, index + 5).map((c) => c.itemKey);
    void ensureCached(window);
  }

  if (!current) {
    return (
      <div className="review-root">
        <div className="review-header">
          <button className="back-btn" type="button" onClick={onClose}>
            ← Done
          </button>
          <span className="review-progress" />
        </div>
        <div className="review-empty">
          <div className="review-empty-title">All caught up.</div>
          <div className="review-empty-hint">
            Mark a word "Need to learn" or "Learned" to schedule it for review.
          </div>
        </div>
      </div>
    );
  }

  const word = findWord(current.itemKey);

  const grade = (rating: RatingName) => {
    onGrade(current.itemKey, rating);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  return (
    <div className="review-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-progress">
          {index + 1} / {total}
        </span>
      </div>
      <div className="review-body">
        <div
          className="review-card"
          role="button"
          tabIndex={0}
          aria-label={revealed ? "Card revealed" : "Tap to reveal answer"}
          onClick={() => setRevealed(true)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setRevealed(true);
            }
          }}
        >
          <div className="review-hanzi">{current.itemKey}</div>
          {!revealed && <div className="review-tap-hint">Tap to reveal</div>}
          {revealed && (
            <>
              <div className="review-pinyin">{word?.pinyin || ""}</div>
              <div className="review-gloss">
                {word
                  ? (word.definitions || []).slice(0, 3).join("; ")
                  : "(loading…)"}
              </div>
            </>
          )}
        </div>
      </div>
      {revealed ? (
        <div className="review-actions">
          <button
            type="button"
            className="review-btn review-btn-again"
            onClick={() => grade("Again")}
          >
            Again
          </button>
          <button
            type="button"
            className="review-btn review-btn-good"
            onClick={() => grade("Good")}
          >
            Good
          </button>
          <button
            type="button"
            className="review-btn review-btn-easy"
            onClick={() => grade("Easy")}
          >
            Easy
          </button>
        </div>
      ) : (
        <div className="review-actions">
          <button
            type="button"
            className="review-btn review-btn-reveal"
            onClick={() => setRevealed(true)}
          >
            Reveal
          </button>
        </div>
      )}
    </div>
  );
}
