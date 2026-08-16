import { useEffect, useState } from "react";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import { buildFocusQueue } from "../lib/focus";
import { scoreToRating, type RatingName } from "../lib/fsrs";
import { crossRefTargets, resolveCrossRefs } from "../lib/gloss";
import type { Facet, ItemKind } from "../lib/types";
import { DrillShell } from "./ui/DrillShell";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { LearnCard } from "./LearnCard";
import { ReverseRecognitionCard } from "./ReverseRecognitionCard";
import { ClozeCharCard } from "./ClozeCharCard";

interface Props {
  // The session's problem words, worst first, already capped.
  words: string[];
  onClose: () => void;
  // Real FSRS grade — only the final test round writes one.
  onGrade: (
    itemKey: string,
    rating: RatingName,
    kind: ItemKind,
    facet: Facet,
    score: number,
  ) => void;
  onOpenEntity: (key: string) => void;
  onOpenTree?: (char: string) => void;
  // Explore-from-here on the lesson card (v130): ends the session.
  onExplore?: (kind: "word" | "char", key: string) => void;
}

// Focus mode (v127): attention for problem words — high exposure,
// persistent failure. Each word gets its lesson, then a practice
// re-test, then a graded test, with rounds interleaved across the
// deck so repetitions are spaced within the session (ADR-0015).
// Practice answers write nothing; only the test round grades. A
// failed test ends with a mnemonic nudge — a memory hook is the
// best-evidenced leech treatment.
export function FocusPage({ words, onClose, onGrade, onOpenEntity, onOpenTree, onExplore }: Props) {
  const { chars } = useCharsCtx();
  const { findWord, ensureCached } = useDictCtx();
  const { savedList } = useSavedCtx();
  const [queue] = useState(() => buildFocusQueue(words));
  const [index, setIndex] = useState(0);
  // Post-test mnemonic nudge for a word whose graded test failed.
  const [hookWord, setHookWord] = useState<string | null>(null);

  const current = queue[index];

  useEffect(() => {
    void ensureCached(words).then(() => {
      const targets = words.flatMap((w) => crossRefTargets(findWord(w)?.definitions ?? []));
      if (targets.length > 0) void ensureCached(targets);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  if (!current) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Focus" progress="" />
        <EmptyState
          variant="review"
          title="Focus session done."
          hint="These words got a lesson and two spaced re-tests — the graded one sets their next review."
        />
      </div>
    );
  }

  const glossOf = (key: string) => {
    const w = findWord(key);
    const cd = chars?.[key];
    return resolveCrossRefs(w ? w.definitions || [] : cd?.definitions || [], findWord)
      .slice(0, 3)
      .join("; ");
  };
  const savedWords = savedList.map((s) => s.word);
  const advance = () => setIndex((i) => i + 1);

  if (hookWord) {
    return (
      <DrillShell
        tag="Focus"
        onClose={onClose}
        progressIndex={Math.min(index + 1, queue.length)}
        total={queue.length}
        onSkip={() => {
          setHookWord(null);
          advance();
        }}
      >
        <div className="phonetic-tap">
          <div className="phonetic-tap-inner">
            <div className="phonetic-tap-prompt">Still slippery. A memory hook helps it stick.</div>
            <div className="reverse-gloss">{hookWord}</div>
            <div className="combined-grade-row">
              <button
                type="button"
                className="review-btn review-btn-reveal"
                onClick={() => onOpenEntity(hookWord)}
              >
                Add a memory hook
              </button>
              <button
                type="button"
                className="review-btn review-btn-good"
                onClick={() => {
                  setHookWord(null);
                  advance();
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </DrillShell>
    );
  }

  const stepKey = `${current.kind}|${current.word}`;
  const isMulti = [...current.word].length > 1;

  return (
    <DrillShell
      tag={
        current.kind === "lesson"
          ? "Focus · learn"
          : current.kind === "practice"
            ? "Focus · practice"
            : "Focus · test"
      }
      onClose={onClose}
      progressIndex={index + 1}
      total={queue.length}
      onSkip={advance}
    >
      {current.kind === "lesson" ? (
        <LearnCard
          key={stepKey}
          word={current.word}
          continueLabel="Got it"
          onContinue={advance}
          onOpenEntity={onOpenEntity}
          onOpenTree={onOpenTree}
          onExplore={onExplore}
        />
      ) : current.kind === "practice" ? (
        // Practice round: objective re-test, nothing written.
        <ReverseRecognitionCard
          key={stepKey}
          answer={current.word}
          gloss={glossOf(current.word)}
          savedWords={savedWords}
          onScore={advance}
          onOpenEntity={onOpenEntity}
        />
      ) : isMulti ? (
        // Graded test: a DIFFERENT format from practice where possible.
        <ClozeCharCard
          key={stepKey}
          word={current.word}
          gloss={glossOf(current.word)}
          savedWords={savedWords}
          onScore={(score) => {
            onGrade(current.word, scoreToRating(score), "word", "clozeChar", score);
            if (score < 1) setHookWord(current.word);
            else advance();
          }}
          onOpenEntity={onOpenEntity}
        />
      ) : (
        <ReverseRecognitionCard
          key={stepKey}
          answer={current.word}
          gloss={glossOf(current.word)}
          savedWords={savedWords}
          onScore={(score) => {
            onGrade(current.word, scoreToRating(score), "word", "reverseRecognition", score);
            if (score < 1) setHookWord(current.word);
            else advance();
          }}
          onOpenEntity={onOpenEntity}
        />
      )}
    </DrillShell>
  );
}
