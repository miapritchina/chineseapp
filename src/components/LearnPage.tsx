import { useEffect, useState } from "react";
import { useDictCtx } from "../state/contexts";
import { stopSpeech } from "../lib/speech";
import { DrillShell } from "./ui/DrillShell";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { LearnCard } from "./LearnCard";

interface Props {
  // The lesson's words, already ordered and capped by the caller.
  words: string[];
  onClose: () => void;
  // Open the EntitySheet for a tapped glyph.
  onOpenEntity: (key: string) => void;
  // Open the full d3 decomposition tree for a character (v115).
  onOpenTree?: (char: string) => void;
  // Explore-from-here on the lesson card (v130): ends the session.
  onExplore?: (kind: "word" | "char", key: string) => void;
  // Called once per finished lesson card — applies the small
  // passive-style schedule nudge ("introduced", not "answered").
  onIntroduced: (word: string) => void;
  // Flow mode (v114): called when the lesson is exhausted, instead of
  // showing the end state — the parent advances to the next stage.
  onComplete?: () => void;
}

// Learn mode (v110, owner request): an "exercise" that TEACHES
// instead of testing. Each card (LearnCard) walks one word through
// sound → per-character breakdown → related words, then a Continue
// tap. No grading anywhere; finishing a card marks the word
// introduced so tomorrow's review is its first real test.
export function LearnPage({
  words,
  onClose,
  onOpenEntity,
  onOpenTree,
  onExplore,
  onIntroduced,
  onComplete,
}: Props) {
  const { ensureCached } = useDictCtx();
  const [index, setIndex] = useState(0);
  const current = words[index];

  useEffect(() => {
    void ensureCached(words);
  }, [words, ensureCached]);
  useEffect(() => () => stopSpeech(), []);

  useEffect(() => {
    if (!current && onComplete) onComplete();
  }, [current, onComplete]);

  if (!current) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Learn" progress="" />
        <EmptyState
          variant="review"
          title="Lesson complete."
          hint={`${words.length} word${words.length === 1 ? "" : "s"} introduced — they'll come up for a real review soon.`}
        />
      </div>
    );
  }

  return (
    <DrillShell
      tag="Learn"
      onClose={onClose}
      progressIndex={index + 1}
      total={words.length}
      onSkip={() => setIndex((i) => i + 1)}
    >
      <LearnCard
        word={current}
        continueLabel={index + 1 < words.length ? "Got it · next word" : "Got it · finish"}
        onContinue={() => {
          onIntroduced(current);
          setIndex((i) => i + 1);
        }}
        onOpenEntity={onOpenEntity}
        onOpenTree={onOpenTree}
        onExplore={onExplore}
      />
    </DrillShell>
  );
}
