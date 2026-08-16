import { useEffect, useMemo, useState } from "react";
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
  // Open the full d3 decomposition tree — for the whole word (hero
  // button, v128) or a single character.
  onOpenTree?: (key: string) => void;
}

// One word's lesson: sound → per-character breakdown (components with
// role colors + the dictionary's etymology notes) → the owner's
// related words → Continue. Extracted from LearnPage (v125) so Sift
// can teach a word the user just marked as unknown. Since v128 every
// breakdown card can be uncollapsed in place: its components join the
// list as the next entries, indented, themselves expandable — any
// number of layers deep.
export function LearnCard({ word, continueLabel, onContinue, onOpenEntity, onOpenTree }: Props) {
  const { chars } = useCharsCtx();
  const { findWord } = useDictCtx();
  const { savedList } = useSavedCtx();
  // Characters whose components are unfolded into the list.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const savedWords = useMemo(() => savedList.map((s) => s.word), [savedList]);
  const entry = findWord(word);
  const heroDefs = useResolvedDefs(entry?.definitions ?? chars?.[word]?.definitions ?? []);

  // Hear the word as its lesson opens.
  useEffect(() => {
    autoSpeak(word);
  }, [word]);

  const toggleExpand = (c: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  // The breakdown list: the word's characters, with every expanded
  // entry's components spliced in right after it (depth-first), so
  // deeper layers read as indented next steps of the same list. The
  // path set guards against decomposition cycles in the data.
  const glyphs = [...new Set(word)];
  const items: { char: string; depth: number }[] = [];
  const visit = (c: string, depth: number, path: Set<string>) => {
    items.push({ char: c, depth });
    if (!expanded.has(c)) return;
    for (const p of chars?.[c]?.components ?? []) {
      if (!p.char || path.has(p.char) || !chars?.[p.char]) continue;
      visit(p.char, depth + 1, new Set(path).add(p.char));
    }
  };
  for (const c of glyphs) visit(c, 0, new Set([c]));

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
        <div className="learn-hero-actions">
          <button type="button" className="review-tap-replay" onClick={() => speak(word)}>
            🔊 replay
          </button>
          {onOpenTree && (
            <button type="button" className="review-tap-replay" onClick={() => onOpenTree(word)}>
              ⤢ tree
            </button>
          )}
        </div>
      </div>

      {items.map(({ char: c, depth }, i) => {
        const cd = chars?.[c];
        if (!cd) return null;
        const pieces = (cd.components ?? []).filter((p) => p.char);
        const canExpand = pieces.some((p) => chars?.[p.char]);
        const isOpen = expanded.has(c);
        const note = cleanEtymologyNotes(cd.notes);
        return (
          <div
            className="learn-char"
            key={`${c}@${i}`}
            style={depth > 0 ? { marginLeft: Math.min(depth, 3) * 14 } : undefined}
          >
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
              {canExpand && (
                <button
                  type="button"
                  className="sheet-etym-expand learn-char-tree"
                  aria-label={
                    isOpen ? `Collapse the components of ${c}` : `Show the components of ${c}`
                  }
                  aria-expanded={isOpen}
                  title={isOpen ? "Hide components" : "Show components below"}
                  onClick={() => toggleExpand(c)}
                >
                  {isOpen ? "▴" : "▾"}
                </button>
              )}
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
