import { useEffect, useRef, useState } from "react";
import type { Word } from "../lib/types";
import { StatusButton } from "./StatusButton";
import { toneLabel } from "../lib/pinyin";
import { detectPos } from "../lib/pos";
import { useCharsCtx, useSavedCtx } from "../state/contexts";
import { SheetHeader } from "./sheet/SheetHeader";
import { EtymologySection } from "./sheet/EtymologySection";
import { RelatedSection } from "./sheet/RelatedSection";
import { MnemonicSection } from "./sheet/MnemonicSection";
import { commonnessLabel, roleColor } from "./sheet/helpers";

interface Props {
  // Exactly one of these identifies the entity. `word` wins when both
  // are set. A single-character word is rendered the same way as a bare
  // character ("a character can be a word — don't model them apart").
  word?: Word | null;
  charKey?: string;
  onClose: () => void;
  onOpenWord: (word: string) => void;
  onOpenChar: (charKey: string) => void;
  // Open the full recursive d3 decomposition tree for THIS entity.
  onOpenTree: () => void;
}

// Unified detail surface: a bottom sheet on mobile (drag handle, slides
// up, swipe down to dismiss), a centered modal on desktop. Opened on
// every word / character / component tap, so the home grid, search
// results, decomposition-tree nodes and the sheet's own sub-entity
// chips all land on the same chrome.
//
// This file is the shell — identity resolution, drag-to-dismiss, the
// status corner, section numbering. The four content blocks live in
// src/components/sheet/:
//   ── (header)                — SheetHeader (eyebrow + glyph + defs)
//   ── Nº 01 · ETYMOLOGY / MADE OF      — EtymologySection
//   ── Nº 02 · IN YOUR SAVED WORDS / CHARACTERS — RelatedSection
//   ── 💡 Make it stick        — MnemonicSection
export function EntitySheet({ word, charKey, onClose, onOpenWord, onOpenChar, onOpenTree }: Props) {
  const { chars } = useCharsCtx();
  const { saved, getStatus, setStatus } = useSavedCtx();

  // ── Identity ───────────────────────────────────────────────────
  const key = word?.word ?? charKey ?? "";
  const isMultiCharWord = !!word && [...word.word].length > 1;
  const charData = chars[key];
  // For a single-char word the dictionary row usually has richer
  // glosses than the chars file; prefer it when present.
  const defs =
    word?.definitions && word.definitions.length > 0
      ? word.definitions
      : (charData?.definitions ?? []);
  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const tone = toneLabel(pinyin);
  const freq = commonnessLabel(word?.rank);
  const pos = defs.length > 0 ? detectPos({ word: key, definitions: defs } as Word) : null;

  // ── Refs + dismiss state ───────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 699px)").matches;
  const dragStartY = useRef<number | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const onDragStart = (e: React.PointerEvent) => {
    if (!isMobile) return;
    dragStartY.current = e.clientY;
    setDragDy(0);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.clientY - dragStartY.current;
    setDragDy(dy > 0 ? dy : 0);
  };
  const onDragEnd = () => {
    if (dragStartY.current === null) return;
    const dy = dragDy;
    dragStartY.current = null;
    if (dy > 90) onClose();
    else setDragDy(0);
  };

  // Reset drag offset on entity change so the panel doesn't stay
  // translated when the user drills into a sub-entity mid-drag.
  useEffect(() => {
    setDragDy(0);
  }, [key]);

  // ── Escape closes ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Etymology / "made of" pieces ───────────────────────────────
  // For a word: the characters it's spelled with. For a character:
  // its direct components (role-tinted). Both are characters, so both
  // are tappable into their own sheet.
  const pieces: { char: string; color?: string }[] = isMultiCharWord
    ? [...word!.word].map((c) => ({ char: c }))
    : (charData?.components ?? [])
        .filter((c) => c?.char && c.char !== "◎")
        .map((c) => ({ char: c.char!, color: roleColor(c.type) }));
  const hasEtym =
    pieces.length > 0 ||
    (!isMultiCharWord &&
      (!!charData?.notes ||
        (!!charData?.originalMeaning && charData.originalMeaning !== "characterless component")));

  const matches = isMultiCharWord ? [] : [...saved].filter((w) => w !== key && w.includes(key));

  // Section numbering: ETYMOLOGY is Nº 01 only when it renders.
  let sectionNo = 0;
  const nextNo = () => String(++sectionNo).padStart(2, "0");
  const etymNo = hasEtym ? nextNo() : null;
  const peopleNo = isMultiCharWord || matches.length > 0 ? nextNo() : null;
  const mnemonicNo = nextNo();

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={`Details for ${key}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet-panel"
        style={dragDy ? { transform: `translateY(${dragDy}px)`, transition: "none" } : undefined}
      >
        <div
          className="sheet-grip-zone"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="sheet-handle" aria-hidden="true" />
        </div>

        <button className="sheet-dismiss" type="button" aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="sheet-status">
          <StatusButton
            status={getStatus(key)}
            variant="iconLg"
            onChange={(n) => setStatus(key, n)}
          />
        </div>

        <SheetHeader
          itemKey={key}
          word={word}
          isMultiCharWord={isMultiCharWord}
          pinyin={pinyin}
          tone={tone}
          freq={freq}
          pos={pos}
          defs={defs}
        />

        {hasEtym && etymNo && (
          <EtymologySection
            num={etymNo}
            itemKey={key}
            isMultiCharWord={isMultiCharWord}
            pieces={pieces}
            charData={charData}
            onOpenChar={onOpenChar}
            onOpenTree={onOpenTree}
          />
        )}

        {(isMultiCharWord || matches.length > 0) && peopleNo && (
          <RelatedSection
            num={peopleNo}
            isMultiCharWord={isMultiCharWord}
            word={word}
            matches={matches}
            onOpenWord={onOpenWord}
            onOpenChar={onOpenChar}
          />
        )}

        <MnemonicSection
          num={mnemonicNo}
          itemKey={key}
          isMultiCharWord={isMultiCharWord}
          pinyin={pinyin}
          defs={defs}
          charData={charData}
          word={word}
          chars={chars}
        />

        <a
          className="sheet-network-link"
          role="button"
          href={`./network/?focus=${encodeURIComponent(key)}`}
          onClick={onClose}
        >
          Show in network →
        </a>
      </div>
    </div>
  );
}
