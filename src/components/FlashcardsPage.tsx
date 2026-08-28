import { useEffect, useState } from "react";
import { useCharsCtx, useDictCtx } from "../state/contexts";
import { autoSpeak, prefetchSpeech, speak, stopSpeech } from "../lib/speech";
import { useResolvedDefs } from "../hooks/useResolvedDefs";
import type { RatingName } from "../lib/fsrs";
import { DrillShell } from "./ui/DrillShell";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { Entity } from "./Entity";
import { GradeButtons } from "./ui/GradeButtons";
import { DRILL_HELP } from "../lib/drillHelp";

// Cards whose audio is fetched ahead of the one on screen, so a flip
// to the next card never waits on the network (v153).
const AUDIO_LOOKAHEAD = 5;

interface Props {
  // The deck, pre-ordered by the caller (lib/flashcards.ts).
  words: string[];
  onClose: () => void;
  // Optional self-grade on flip → a real FSRS grade on the word's
  // recognition rows. Skipping it keeps the mode pressure-free.
  onGrade: (word: string, rating: RatingName) => void;
  // Advancing without grading still counts as a light look — the small
  // passive-view nudge (useReview.creditPassiveView).
  onBrowse: (word: string) => void;
}

// Flashcards (v143, owner request): a low-pressure counterpart to the
// graded review workout. Flip a card to see pinyin + meaning; grading is
// optional. The deck is spaced-repetition ordered (lib/flashcards.ts) so
// it leads with what's worth seeing instead of well-known words.
export function FlashcardsPage({ words, onClose, onGrade, onBrowse }: Props) {
  const { ensureCached } = useDictCtx();
  const [index, setIndex] = useState(0);
  const current = words[index];

  useEffect(() => {
    void ensureCached(words.slice(index, index + 6));
    prefetchSpeech(words.slice(index, index + AUDIO_LOOKAHEAD));
  }, [words, index, ensureCached]);
  useEffect(() => () => stopSpeech(), []);

  if (!current) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Flashcards" progress="" />
        <EmptyState
          variant="review"
          title="That's the deck."
          hint={
            words.length === 0
              ? "Save a word to start a flashcard deck."
              : "Come back later — new cards surface as they come due."
          }
        />
      </div>
    );
  }

  const advance = () => setIndex((i) => i + 1);

  return (
    <DrillShell
      tag="Flashcards"
      onClose={onClose}
      progressIndex={index + 1}
      total={words.length}
      onSkip={advance}
      help={DRILL_HELP.flashcards}
    >
      <FlashcardFace
        key={current}
        itemKey={current}
        onGrade={(rating) => {
          onGrade(current, rating);
          advance();
        }}
        onNext={() => {
          onBrowse(current);
          advance();
        }}
      />
    </DrillShell>
  );
}

function FlashcardFace({
  itemKey,
  onGrade,
  onNext,
}: {
  itemKey: string;
  onGrade: (rating: RatingName) => void;
  onNext: () => void;
}) {
  const { findWord } = useDictCtx();
  const { chars } = useCharsCtx();
  const [revealed, setRevealed] = useState(false);

  const word = findWord(itemKey);
  const charData = chars[itemKey];
  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const defs = useResolvedDefs(word ? word.definitions || [] : charData?.definitions || []);
  const gloss = defs.slice(0, 3).join("; ");

  // Unlike the graded drills, flashcards speak on the front — hearing
  // the word alongside the hanzi is the point of the low-pressure deck,
  // and there's no answer to give away.
  useEffect(() => {
    autoSpeak(itemKey);
  }, [itemKey]);

  return (
    <div
      className="combined-card-surface flashcard-surface"
      onClick={() => (revealed ? onNext() : setRevealed(true))}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (revealed) onNext();
          else setRevealed(true);
        }
      }}
      aria-label={revealed ? "Tap anywhere for the next card" : "Tap anywhere to reveal"}
    >
      <div className="combined-card-stack">
        <Entity
          itemKey={itemKey}
          size="hero"
          showPinyin={false}
          showMeaning={false}
          ariaLabel={itemKey}
        />
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
              <div className="combined-grade-label">Rate it? (optional)</div>
              <div className="combined-grade-row">
                <GradeButtons
                  ratings={["Again", "Good"]}
                  labels={{ Again: "Forgot", Good: "Knew it" }}
                  onPick={onGrade}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
