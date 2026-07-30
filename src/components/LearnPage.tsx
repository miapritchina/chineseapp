import { useEffect, useMemo, useState } from "react";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import { wordsSharingChar } from "../lib/explore";
import { cleanEtymologyNotes } from "../lib/etymology";
import { autoSpeak, speak, stopSpeech } from "../lib/speech";
import { DrillShell } from "./ui/DrillShell";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { Entity } from "./Entity";
import { CharFormula } from "./ui/CharFormula";
import { useResolvedDefs } from "../hooks/useResolvedDefs";

interface Props {
  // The lesson's words, already ordered and capped by the caller.
  words: string[];
  onClose: () => void;
  // Open the EntitySheet for a tapped glyph.
  onOpenEntity: (key: string) => void;
  // Open the full d3 decomposition tree for a character (v115).
  onOpenTree?: (char: string) => void;
  // Called once per finished lesson card — applies the small
  // passive-style schedule nudge ("introduced", not "answered").
  onIntroduced: (word: string) => void;
  // Flow mode (v114): called when the lesson is exhausted, instead of
  // showing the end state — the parent advances to the next stage.
  onComplete?: () => void;
}

// Learn mode (v110, owner request): an "exercise" that TEACHES
// instead of testing. Each card walks one word through sound →
// per-character breakdown (components with role colors + the
// dictionary's etymology notes) → the owner's related words, then a
// Continue tap. No grading anywhere; finishing a card marks the word
// introduced so tomorrow's review is its first real test.
export function LearnPage({
  words,
  onClose,
  onOpenEntity,
  onOpenTree,
  onIntroduced,
  onComplete,
}: Props) {
  const { chars } = useCharsCtx();
  const { findWord, ensureCached } = useDictCtx();
  const { savedList } = useSavedCtx();
  const [index, setIndex] = useState(0);

  const savedWords = useMemo(() => savedList.map((s) => s.word), [savedList]);
  const current = words[index];

  useEffect(() => {
    void ensureCached(words);
  }, [words, ensureCached]);

  // Hear the word as its lesson opens.
  useEffect(() => {
    if (current) autoSpeak(current);
  }, [current]);
  useEffect(() => () => stopSpeech(), []);

  useEffect(() => {
    if (!current && onComplete) onComplete();
  }, [current, onComplete]);

  const word = current ? findWord(current) : null;
  const heroDefs = useResolvedDefs(
    word?.definitions ?? (current ? chars?.[current]?.definitions : undefined) ?? [],
  );

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

  const glyphs = [...new Set(current)];
  const related = wordsSharingChar(current, savedWords).slice(0, 6);

  const advance = () => {
    onIntroduced(current);
    setIndex((i) => i + 1);
  };

  return (
    <DrillShell
      tag="Learn"
      onClose={onClose}
      progressIndex={index + 1}
      total={words.length}
      onSkip={() => setIndex((i) => i + 1)}
    >
      <div className="learn-body" key={current}>
        <div className="learn-hero">
          <span
            className="learn-hanzi is-explorable"
            onClick={() => onOpenEntity(current)}
            role="button"
            tabIndex={0}
          >
            {current}
          </span>
          <div className="review-pinyin review-pinyin-lg">
            {word?.pinyin ?? chars?.[current]?.pinyin ?? ""}
          </div>
          <div className="review-gloss">{heroDefs.slice(0, 3).join("; ")}</div>
          <button type="button" className="review-tap-replay" onClick={() => speak(current)}>
            🔊 replay
          </button>
        </div>

        {glyphs.map((c) => {
          const cd = chars?.[c];
          if (!cd) return null;
          const pieces = (cd.components ?? []).filter((p) => p.char);
          const note = cleanEtymologyNotes(cd.notes);
          return (
            <div className="learn-char" key={c}>
              <div className="learn-char-head">
                <span
                  className="learn-char-glyph is-explorable"
                  onClick={() => onOpenEntity(c)}
                  role="button"
                  tabIndex={0}
                >
                  {c}
                </span>
                <span className="learn-char-meta">
                  <span className="learn-char-pinyin">{cd.pinyin}</span>
                  <span className="learn-char-def">{cd.definitions?.[0] ?? ""}</span>
                </span>
                {onOpenTree && pieces.length > 0 && (
                  <button
                    type="button"
                    className="sheet-etym-expand learn-char-tree"
                    aria-label={`Open the decomposition tree for ${c}`}
                    title="Full decomposition tree"
                    onClick={() => onOpenTree(c)}
                  >
                    ⤢
                  </button>
                )}
              </div>
              <CharFormula pieces={pieces} onOpenEntity={onOpenEntity} />
              {note && <div className="learn-note">{note}</div>}
              {!note && cd.originalMeaning && (
                <div className="learn-note">Originally: {cd.originalMeaning}</div>
              )}
            </div>
          );
        })}

        {related.length > 0 && (
          <div className="learn-related">
            <div className="launch-section-title">You already know</div>
            <div className="explore-cards">
              {related.map((w) => (
                <Entity
                  key={w}
                  itemKey={w}
                  size="sm"
                  showStatus={false}
                  onTap={() => onOpenEntity(w)}
                />
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="review-btn review-btn-reveal learn-continue"
          onClick={advance}
        >
          {index + 1 < words.length ? "Got it · next word" : "Got it · finish"}
        </button>
      </div>
    </DrillShell>
  );
}
