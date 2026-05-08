import { useEffect, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { ReviewCard } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";

interface Props {
  dueCards: ReviewCard[];
  findWord: (key: string) => Word | null;
  ensureCached: (keys: string[]) => Promise<void>;
  onGrade: (itemKey: string, rating: RatingName) => void;
  onAttributeFailure?: (childKey: string) => void;
  onClose: () => void;
  chars?: Record<string, Char>;
}

// Recognition drill: show the hanzi, tap to reveal pinyin + first defs,
// then grade Again / Good / Easy. Hard intentionally omitted (one fewer
// decision per card; the brief's recommendation).
//
// After Again on a multi-char word, a small banner appears for ~3s asking
// "what threw you?" — tapping a child char attributes the failure to it
// (real Again on the child), tapping outside / waiting dismisses.
export function ReviewPage({
  dueCards,
  findWord,
  ensureCached,
  onGrade,
  onAttributeFailure,
  onClose,
  chars,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const [attribTarget, setAttribTarget] = useState<string | null>(null);

  const total = dueCards.length;
  const current = dueCards[index];

  // Hydrate the next few words so reveal is instant.
  useEffect(() => {
    if (!current) return;
    const window = dueCards.slice(index, index + 5).map((c) => c.itemKey);
    void ensureCached(window);
  }, [current, dueCards, ensureCached, index]);

  // Auto-dismiss the "what threw you" banner after 3s.
  useEffect(() => {
    if (!attribTarget) return;
    const t = window.setTimeout(() => setAttribTarget(null), 3000);
    return () => window.clearTimeout(t);
  }, [attribTarget]);

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
            Save a new word to add it to the review queue.
          </div>
        </div>
      </div>
    );
  }

  const word = current.itemKind === "word" ? findWord(current.itemKey) : null;
  const charData = chars?.[current.itemKey];
  // For char-kind cards we lean on data-chars.json; falls back to the
  // raw key if data isn't loaded yet.
  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const gloss = word
    ? (word.definitions || []).slice(0, 3).join("; ")
    : (charData?.definitions || []).slice(0, 3).join("; ");

  const advance = () => {
    setRevealed(false);
    setAttribTarget(null);
    setIndex((i) => i + 1);
  };

  const grade = (rating: RatingName) => {
    onGrade(current.itemKey, rating);
    if (
      rating === "Again" &&
      current.itemKind === "word" &&
      [...current.itemKey].length > 1 &&
      onAttributeFailure
    ) {
      // Don't advance yet — show the attribution banner first.
      setAttribTarget(current.itemKey);
      return;
    }
    advance();
  };

  const attribute = (childKey: string) => {
    onAttributeFailure?.(childKey);
    setAttribTarget(null);
    advance();
  };

  return (
    <div className="review-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-kind-tag">
          {current.itemKind === "word" ? "Word" : "Character"}
        </span>
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
              <div className="review-pinyin">{pinyin}</div>
              <div className="review-gloss">
                {gloss || "(no dictionary entry)"}
              </div>
            </>
          )}
        </div>
      </div>
      {attribTarget ? (
        <div className="review-attrib">
          <div className="review-attrib-title">What threw you?</div>
          <div className="review-attrib-row">
            {[...attribTarget].map((c) => (
              <button
                key={c}
                type="button"
                className="review-attrib-pick"
                onClick={() => attribute(c)}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              className="review-attrib-skip"
              onClick={advance}
            >
              Skip
            </button>
          </div>
        </div>
      ) : revealed ? (
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
