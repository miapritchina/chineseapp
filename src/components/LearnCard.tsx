import { useEffect, useMemo } from "react";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import { wordsSharingChar } from "../lib/explore";
import { cleanEtymologyNotes } from "../lib/etymology";
import { autoSpeak, speak } from "../lib/speech";
import { Entity } from "./Entity";
import { CharFormula } from "./ui/CharFormula";
import { useResolvedDefs } from "../hooks/useResolvedDefs";

interface Props {
  word: string;
  continueLabel: string;
  onContinue: () => void;
  // Open the EntitySheet for a tapped glyph.
  onOpenEntity: (key: string) => void;
  // Open the full d3 decomposition tree for a character (v115).
  onOpenTree?: (char: string) => void;
}

// One word's lesson: sound → per-character breakdown (components with
// role colors + the dictionary's etymology notes) → the owner's
// related words → Continue. Extracted from LearnPage (v125) so Sift
// can teach a word the user just marked as unknown.
export function LearnCard({ word, continueLabel, onContinue, onOpenEntity, onOpenTree }: Props) {
  const { chars } = useCharsCtx();
  const { findWord } = useDictCtx();
  const { savedList } = useSavedCtx();

  const savedWords = useMemo(() => savedList.map((s) => s.word), [savedList]);
  const entry = findWord(word);
  const heroDefs = useResolvedDefs(entry?.definitions ?? chars?.[word]?.definitions ?? []);

  // Hear the word as its lesson opens.
  useEffect(() => {
    autoSpeak(word);
  }, [word]);

  const glyphs = [...new Set(word)];
  const related = wordsSharingChar(word, savedWords).slice(0, 6);

  return (
    <div className="learn-body" key={word}>
      <div className="learn-hero">
        <span
          className="learn-hanzi is-explorable"
          onClick={() => onOpenEntity(word)}
          role="button"
          tabIndex={0}
        >
          {word}
        </span>
        <div className="review-pinyin review-pinyin-lg">
          {entry?.pinyin ?? chars?.[word]?.pinyin ?? ""}
        </div>
        <div className="review-gloss">{heroDefs.slice(0, 3).join("; ")}</div>
        <button type="button" className="review-tap-replay" onClick={() => speak(word)}>
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
        onClick={onContinue}
      >
        {continueLabel}
      </button>
    </div>
  );
}
