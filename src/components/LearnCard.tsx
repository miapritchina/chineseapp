import { useEffect, useMemo, useState } from "react";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import { cleanEtymologyNotes } from "../lib/etymology";
import { autoSpeak, speak } from "../lib/speech";
import { crossRefTargets, resolveCrossRefs } from "../lib/gloss";
import { detectPos, POS_COLOR, POS_LABEL } from "../lib/pos";
import type { Word } from "../lib/types";
import { StatusButton } from "./StatusButton";
import { CharFormula } from "./ui/CharFormula";
import { RelatedWordsColumns } from "./sheet/RelatedWordsColumns";
import { MnemonicSection } from "./sheet/MnemonicSection";
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
  // Jump into the Explore page focused on this word (v130 — the
  // sheet's "Explore from here" merged in; ends the session).
  onExplore?: (kind: "word" | "char", key: string) => void;
}

// One word's lesson page. Since v130 this is the merged study surface
// (owner: lesson + sheet + tree said the same thing three ways — the
// sheet's elements now live HERE): status star, POS chip, sound →
// per-character breakdown (expandable in place, any depth — v128) →
// related words per character → mnemonic → explore link. Extracted
// from LearnPage in v125; also used by Sift lessons and Focus.
export function LearnCard({
  word,
  continueLabel,
  onContinue,
  onOpenEntity,
  onOpenTree,
  onExplore,
}: Props) {
  const { chars } = useCharsCtx();
  const { findWord, ensureCached } = useDictCtx();
  const { getStatus, setStatus } = useSavedCtx();
  // Characters whose components are unfolded into the list.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const entry = findWord(word);
  const heroDefs = useResolvedDefs(entry?.definitions ?? chars?.[word]?.definitions ?? []);
  const pos = heroDefs.length > 0 ? detectPos({ word, definitions: heroDefs } as Word) : null;
  const isMulti = [...word].length > 1;

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

  // Per-character glosses with "variant of X" resolved; one background
  // fetch covers every cross-ref target in the visible list.
  const itemTargetsKey = useMemo(
    () => items.flatMap(({ char: c }) => crossRefTargets(chars?.[c]?.definitions ?? [])).join("\n"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.map((i) => i.char).join(""), chars],
  );
  useEffect(() => {
    if (itemTargetsKey) void ensureCached(itemTargetsKey.split("\n"));
  }, [itemTargetsKey, ensureCached]);

  return (
    <div className="learn-body" key={word}>
      <div className="learn-hero">
        <div className="learn-hero-status">
          <StatusButton
            status={getStatus(word)}
            variant="iconLg"
            onChange={(next) => setStatus(word, next)}
          />
        </div>
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
        <div className="review-gloss">
          {pos && (
            <span className="sheet-pos" style={{ color: POS_COLOR[pos] }}>
              {POS_LABEL[pos].toUpperCase()}
            </span>
          )}
          {pos && <span className="sheet-defs-sep"> • </span>}
          {heroDefs.slice(0, 3).join("; ")}
        </div>
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
        const def = resolveCrossRefs(cd.definitions ?? [], findWord)[0] ?? "";
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
                <span className="learn-char-def">{def}</span>
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

      <RelatedWordsColumns wordKey={word} onOpenWord={onOpenEntity} />

      <MnemonicSection
        itemKey={word}
        isMultiCharWord={isMulti}
        pinyin={entry?.pinyin ?? chars?.[word]?.pinyin ?? ""}
        defs={heroDefs}
        charData={chars?.[word]}
        word={entry}
        chars={chars ?? {}}
      />

      {onExplore && (
        <button
          type="button"
          className="sheet-network-link"
          onClick={() => onExplore(isMulti ? "word" : "char", word)}
        >
          Explore from here →
        </button>
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
