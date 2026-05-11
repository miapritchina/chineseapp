import { useEffect, useRef, useState } from "react";
import type { Char, Word } from "../lib/types";
import type { Status } from "../hooks/useSaved";
import type { MnemonicEntry } from "../lib/mnemonics";
import { StatusButton } from "./StatusButton";
import { buildStarterMnemonic } from "../lib/mnemonics";
import { toneLabel } from "../lib/pinyin";
import { detectPos, POS_LABEL, POS_COLOR } from "../lib/pos";

interface Props {
  // Single-character key (a character or a component — same thing in
  // this app: a character can be a component of another character).
  charKey: string;
  charData: Char | undefined;
  saved: Set<string>;
  getStatus: (key: string) => Status | null;
  setStatus: (key: string, next: Status | null) => void;
  getMnemonic: (key: string) => MnemonicEntry | null;
  saveMnemonic: (key: string, text: string) => void;
  clearMnemonic: (key: string) => void;
  // Resolve a saved word key → Word, for the "in your saved words" rows.
  findWord: (key: string) => Word | null;
  onClose: () => void;
  // Tap a saved-word chip → open that word (TreeModal, for now).
  onOpenWord: (word: string) => void;
  // Tap the etymology preview → open the full recursive decomposition
  // tree for this character.
  onOpenTree: (charKey: string) => void;
}

// Unified detail surface: a bottom sheet on mobile, a centered modal on
// desktop. Opened on every word / character / component tap. PR 1 handles
// the character/component case (replaces the old CharPopup); PR 2 folds
// in the multi-char word surface (WordDetail) so the same chrome serves
// everything.
//
// Layout cribbed from the "vague design" handoff:
//   PINYIN · TONE n
//   大字 (stroke animation; tap to replay)
//   POS · POS • gloss · gloss · gloss
//   ── Nº 01 · ETYMOLOGY    (one-level decomposition; tap → full tree)
//   ── Nº 02 · IN YOUR SAVED WORDS
//   ── 💡 Make it stick     (editable mnemonic)
export function EntitySheet({
  charKey,
  charData,
  saved,
  getStatus,
  setStatus,
  getMnemonic,
  saveMnemonic,
  clearMnemonic,
  findWord,
  onClose,
  onOpenWord,
  onOpenTree,
}: Props) {
  const writerRef = useRef<HTMLDivElement>(null);
  const writerInstanceRef = useRef<{ animateCharacter: () => void } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Drag-to-dismiss (mobile only) ──────────────────────────────
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 699px)").matches;
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

  // ── Escape closes ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Mnemonic ("💡 Make it stick") ──────────────────────────────
  const starter = buildStarterMnemonic(charKey, charData);
  const stored = getMnemonic(charKey);
  const [mnemonic, setMnemonic] = useState<string>(() => stored?.text ?? starter);
  const [editedFlag, setEditedFlag] = useState<boolean>(() => !!stored?.edited);
  const [mnemonicEditing, setMnemonicEditing] = useState(false);
  useEffect(() => {
    const s = getMnemonic(charKey);
    setMnemonic(s?.text ?? buildStarterMnemonic(charKey, charData));
    setEditedFlag(!!s?.edited);
    setMnemonicEditing(false);
    setDragDy(0);
  }, [charKey, charData, getMnemonic]);
  const persistMnemonic = (text: string) => {
    if (text === starter && !editedFlag) {
      clearMnemonic(charKey);
      return;
    }
    saveMnemonic(charKey, text);
    setEditedFlag(true);
  };
  const resetMnemonic = () => {
    clearMnemonic(charKey);
    setMnemonic(starter);
    setEditedFlag(false);
    setMnemonicEditing(false);
  };

  // ── Stroke animation (hanzi-writer) ────────────────────────────
  useEffect(() => {
    const el = writerRef.current;
    if (!el) return;
    el.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HW = (window as any).HanziWriter;
    const fallback = () => {
      el.innerHTML = "";
      const fb = document.createElement("div");
      fb.className = "sheet-glyph-fallback";
      fb.textContent = charKey;
      el.appendChild(fb);
    };
    if (typeof HW === "undefined") {
      fallback();
      return;
    }
    try {
      const size = Math.min(220, el.clientWidth || 220);
      const writer = HW.create(el, charKey, {
        width: size,
        height: size,
        padding: 4,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 110,
        strokeColor:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--text")
            .trim() || "#222",
        outlineColor:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--border")
            .trim() || "#ddd",
        onLoadCharDataError: fallback,
      });
      writerInstanceRef.current = writer;
      writer.animateCharacter();
    } catch {
      fallback();
    }
    return () => {
      writerInstanceRef.current = null;
    };
  }, [charKey]);
  const replay = () => writerInstanceRef.current?.animateCharacter();

  // ── Derived bits ───────────────────────────────────────────────
  const pinyin = charData?.pinyin ?? "";
  const tone = toneLabel(pinyin);
  const defs = charData?.definitions ?? [];
  // Best-effort POS via the same heuristic the Sentence Studio uses.
  const pos =
    defs.length > 0 ? detectPos({ word: charKey, definitions: defs } as Word) : null;
  const components = (charData?.components ?? []).filter((c) => c?.char && c.char !== "◎");
  const hasEtym =
    components.length > 0 ||
    !!charData?.notes ||
    (!!charData?.originalMeaning &&
      charData.originalMeaning !== "characterless component");
  const matches = [...saved].filter((w) => w !== charKey && w.includes(charKey));

  const roleColor = (type: string | undefined): string | undefined => {
    switch (type) {
      case "sound":
        return "#b14430";
      case "meaning":
        return "#4f7d3a";
      case "iconic":
        return "#2f5a8e";
      default:
        return undefined;
    }
  };

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={`Details for ${charKey}`}>
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
          <StatusButton status={getStatus(charKey)} variant="iconLg" onChange={(n) => setStatus(charKey, n)} />
        </div>

        <div className="sheet-eyebrow">
          {pinyin ? pinyin.toUpperCase() : charKey}
          {tone && <span className="sheet-eyebrow-dot"> · </span>}
          {tone && <span className="sheet-eyebrow-tone">{tone}</span>}
        </div>

        <div
          ref={writerRef}
          className="sheet-glyph"
          role="button"
          tabIndex={0}
          aria-label={`Replay stroke animation for ${charKey}`}
          onClick={replay}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              replay();
            }
          }}
        />

        <div className="sheet-defs">
          {pos && (
            <span className="sheet-pos" style={{ color: POS_COLOR[pos] }}>
              {POS_LABEL[pos].toUpperCase()}
            </span>
          )}
          {pos && <span className="sheet-defs-sep"> • </span>}
          {defs.length ? (
            <span className="sheet-defs-text">{defs.join(" · ")}</span>
          ) : (
            <span className="sheet-defs-text sheet-muted">No dictionary entry.</span>
          )}
        </div>

        {hasEtym && (
          <section className="sheet-section">
            <div className="sheet-section-head">
              <span className="sheet-section-num">Nº 01</span>
              <span className="sheet-section-name">ETYMOLOGY</span>
            </div>
            {components.length > 0 ? (
              <button
                type="button"
                className="sheet-etym-row"
                onClick={() => onOpenTree(charKey)}
                title="Open the full decomposition tree"
              >
                {components.map((c, i) => (
                  <span key={`${c.char}-${i}`} className="sheet-etym-piece">
                    {i > 0 && <span className="sheet-etym-op">+</span>}
                    <span className="sheet-etym-glyph" style={{ color: roleColor(c.type) }}>
                      {c.char}
                    </span>
                  </span>
                ))}
                <span className="sheet-etym-op">=</span>
                <span className="sheet-etym-glyph sheet-etym-result">{charKey}</span>
                <span className="sheet-etym-expand" aria-hidden="true">⤢</span>
              </button>
            ) : null}
            {charData?.originalMeaning &&
              charData.originalMeaning !== "characterless component" && (
                <div className="sheet-etym-note">
                  Originally: {charData.originalMeaning}
                </div>
              )}
            {charData?.notes && <div className="sheet-etym-note sheet-etym-note-em">{charData.notes}</div>}
          </section>
        )}

        {matches.length > 0 && (
          <section className="sheet-section">
            <div className="sheet-section-head">
              <span className="sheet-section-num">Nº {hasEtym ? "02" : "01"}</span>
              <span className="sheet-section-name">IN YOUR SAVED WORDS</span>
            </div>
            <div className="sheet-saved-list">
              {matches.map((w) => {
                const word = findWord(w);
                const gloss = word?.definitions?.[0] ?? "";
                return (
                  <button
                    key={w}
                    className="sheet-saved-row"
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenWord(w);
                    }}
                  >
                    <span className="sheet-saved-hanzi">{w}</span>
                    {word?.pinyin && <span className="sheet-saved-pinyin">{word.pinyin}</span>}
                    {gloss && <span className="sheet-saved-gloss">{gloss}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="sheet-section">
          <div className="sheet-section-head">
            <span className="sheet-section-name sheet-mnemonic-title">
              💡 Make it stick
              {editedFlag && <span className="mnemonic-saved-tag">your version</span>}
            </span>
            {editedFlag && (
              <button
                type="button"
                className="mnemonic-reset"
                onClick={resetMnemonic}
                title="Reset to the auto-suggested mnemonic from the components"
              >
                reset
              </button>
            )}
          </div>
          {mnemonicEditing ? (
            <textarea
              className="mnemonic-textarea"
              value={mnemonic}
              autoFocus
              onChange={(e) => setMnemonic(e.target.value)}
              onBlur={() => {
                persistMnemonic(mnemonic);
                setMnemonicEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setMnemonicEditing(false);
              }}
              rows={3}
              placeholder="Write a story, image, or hook that makes this character memorable…"
            />
          ) : (
            <button
              type="button"
              className={`mnemonic-display${editedFlag ? " is-edited" : " is-default"}`}
              onClick={() => setMnemonicEditing(true)}
              title="Tap to edit"
            >
              {mnemonic || starter}
            </button>
          )}
        </section>

        <a
          className="sheet-network-link"
          role="button"
          href={`./network/?focus=${encodeURIComponent(charKey)}`}
          onClick={onClose}
        >
          Show in network →
        </a>
      </div>
    </div>
  );
}
