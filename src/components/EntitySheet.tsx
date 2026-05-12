import { useEffect, useRef, useState } from "react";
import type { Char, Word } from "../lib/types";
import type { Status } from "../hooks/useSaved";
import type { MnemonicEntry } from "../lib/mnemonics";
import { StatusButton } from "./StatusButton";
import { buildStarterMnemonic, buildStarterWordMnemonic } from "../lib/mnemonics";
import { toneLabel } from "../lib/pinyin";
import { detectPos, POS_LABEL, POS_COLOR } from "../lib/pos";
import { speak } from "../lib/speech";

interface Props {
  // Exactly one of these identifies the entity. `word` wins when both
  // are set. A single-character word is rendered the same way as a bare
  // character ("a character can be a word — don't model them apart").
  word?: Word | null;
  charKey?: string;
  // For etymology lookups (the entity's components are characters too).
  chars: Record<string, Char>;
  saved: Set<string>;
  getStatus: (key: string) => Status | null;
  setStatus: (key: string, next: Status | null) => void;
  getMnemonic: (key: string) => MnemonicEntry | null;
  saveMnemonic: (key: string, text: string) => void;
  clearMnemonic: (key: string) => void;
  findWord: (key: string) => Word | null;
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
// Layout (from the design handoff):
//   PINYIN · TONE n · TOP n
//   大字 / 词        (single chars: tap to replay the stroke animation;
//                     words: tap 🔊 to hear it)
//   POS • gloss · gloss · gloss
//   ── Nº 01 · ETYMOLOGY / MADE OF   (one level; each piece taps into
//                                     its own sheet; ⤢ → full tree)
//   ── Nº 02 · IN YOUR SAVED WORDS / CHARACTERS
//   ── 💡 Make it stick              (editable mnemonic)
export function EntitySheet({
  word,
  charKey,
  chars,
  saved,
  getStatus,
  setStatus,
  getMnemonic,
  saveMnemonic,
  clearMnemonic,
  findWord,
  onClose,
  onOpenWord,
  onOpenChar,
  onOpenTree,
}: Props) {
  // ── Identity ───────────────────────────────────────────────────
  const key = word?.word ?? charKey ?? "";
  const isMultiCharWord = !!word && [...word.word].length > 1;
  const charData = chars[key];
  // For a single-char word the dictionary row usually has richer
  // glosses than the chars file; prefer it when present.
  const defs =
    word?.definitions && word.definitions.length > 0
      ? word.definitions
      : charData?.definitions ?? [];
  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const tone = toneLabel(pinyin);
  const freq = commonnessLabel(word?.rank);
  const pos =
    defs.length > 0 ? detectPos({ word: key, definitions: defs } as Word) : null;

  // ── Refs ───────────────────────────────────────────────────────
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
  const starter = isMultiCharWord
    ? buildStarterWordMnemonic(word!.word, pinyin, defs[0] ?? "", chars)
    : buildStarterMnemonic(key, charData);
  const stored = getMnemonic(key);
  const [mnemonic, setMnemonic] = useState<string>(() => stored?.text ?? starter);
  const [editedFlag, setEditedFlag] = useState<boolean>(() => !!stored?.edited);
  const [mnemonicEditing, setMnemonicEditing] = useState(false);
  useEffect(() => {
    const s = getMnemonic(key);
    setMnemonic(s?.text ?? starter);
    setEditedFlag(!!s?.edited);
    setMnemonicEditing(false);
    setDragDy(0);
    // Re-derive when the entity key changes (the component instance is
    // reused as the user drills around). `starter` / `getMnemonic` are
    // referentially unstable; the effect intentionally doesn't re-fire
    // on those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const persistMnemonic = (text: string) => {
    if (text === starter && !editedFlag) {
      clearMnemonic(key);
      return;
    }
    saveMnemonic(key, text);
    setEditedFlag(true);
  };
  const resetMnemonic = () => {
    clearMnemonic(key);
    setMnemonic(starter);
    setEditedFlag(false);
    setMnemonicEditing(false);
  };

  // ── Stroke animation (single-char entities only) ───────────────
  useEffect(() => {
    if (isMultiCharWord) return;
    const el = writerRef.current;
    if (!el) return;
    el.innerHTML = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const HW = (window as any).HanziWriter;
    const fallback = () => {
      el.innerHTML = "";
      const fb = document.createElement("div");
      fb.className = "sheet-glyph-fallback";
      fb.textContent = key;
      el.appendChild(fb);
    };
    if (typeof HW === "undefined") {
      fallback();
      return;
    }
    try {
      const size = Math.min(220, el.clientWidth || 220);
      const writer = HW.create(el, key, {
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
  }, [key, isMultiCharWord]);
  const replay = () => writerInstanceRef.current?.animateCharacter();

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
        (!!charData?.originalMeaning &&
          charData.originalMeaning !== "characterless component")));

  const matches = isMultiCharWord
    ? []
    : [...saved].filter((w) => w !== key && w.includes(key));

  // Section numbering: ETYMOLOGY is Nº 01 only when it renders.
  let sectionNo = 0;
  const nextNo = () => String(++sectionNo).padStart(2, "0");
  const etymNo = hasEtym ? nextNo() : null;
  const peopleNo =
    isMultiCharWord || matches.length > 0 ? nextNo() : null;
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
          <StatusButton status={getStatus(key)} variant="iconLg" onChange={(n) => setStatus(key, n)} />
        </div>

        <div className="sheet-eyebrow">
          <span>{pinyin ? pinyin.toUpperCase() : key}</span>
          {tone && <span className="sheet-eyebrow-dim"> · {tone}</span>}
          {freq && <span className="sheet-eyebrow-dim"> · {freq.toUpperCase()}</span>}
        </div>

        {isMultiCharWord ? (
          <div className="sheet-glyph sheet-glyph-word">
            <span className="sheet-glyph-text">{word!.word}</span>
            <button
              type="button"
              className="sheet-speak"
              aria-label={`Play ${word!.word}`}
              onClick={() => speak(word!.word)}
            >
              🔊
            </button>
          </div>
        ) : (
          <div
            ref={writerRef}
            className="sheet-glyph"
            role="button"
            tabIndex={0}
            aria-label={`Replay stroke animation for ${key}`}
            onClick={replay}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                replay();
              }
            }}
          />
        )}

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
              <span className="sheet-section-num">Nº {etymNo}</span>
              <span className="sheet-section-name">
                {isMultiCharWord ? "MADE OF" : "ETYMOLOGY"}
              </span>
            </div>
            {pieces.length > 0 && (
              <div className="sheet-etym-row">
                {pieces.map((p, i) => (
                  <span key={`${p.char}-${i}`} className="sheet-etym-piece">
                    {i > 0 && <span className="sheet-etym-op">+</span>}
                    <button
                      type="button"
                      className="sheet-etym-glyph sheet-etym-glyph-btn"
                      style={p.color ? { color: p.color } : undefined}
                      onClick={() => onOpenChar(p.char)}
                      title={`Open ${p.char}`}
                    >
                      {p.char}
                    </button>
                  </span>
                ))}
                <span className="sheet-etym-op">=</span>
                <span className="sheet-etym-glyph sheet-etym-result">{key}</span>
                <button
                  type="button"
                  className="sheet-etym-expand"
                  aria-label="Open the full decomposition tree"
                  title="Full decomposition tree"
                  onClick={onOpenTree}
                >
                  ⤢
                </button>
              </div>
            )}
            {!isMultiCharWord &&
              charData?.originalMeaning &&
              charData.originalMeaning !== "characterless component" && (
                <div className="sheet-etym-note">
                  Originally: {charData.originalMeaning}
                </div>
              )}
            {!isMultiCharWord && charData?.notes && (
              <div className="sheet-etym-note sheet-etym-note-em">{charData.notes}</div>
            )}
          </section>
        )}

        {(isMultiCharWord || matches.length > 0) && (
          <section className="sheet-section">
            <div className="sheet-section-head">
              <span className="sheet-section-num">Nº {peopleNo}</span>
              <span className="sheet-section-name">
                {isMultiCharWord ? "CHARACTERS" : "IN YOUR SAVED WORDS"}
              </span>
            </div>
            <div className="sheet-saved-list">
              {isMultiCharWord
                ? [...word!.word].map((c, i) => {
                    const cd = chars[c];
                    const gloss = cd?.definitions?.[0] ?? "";
                    return (
                      <button
                        key={`${c}-${i}`}
                        className="sheet-saved-row"
                        type="button"
                        onClick={() => onOpenChar(c)}
                      >
                        <span className="sheet-saved-hanzi">{c}</span>
                        {cd?.pinyin && <span className="sheet-saved-pinyin">{cd.pinyin}</span>}
                        {gloss && <span className="sheet-saved-gloss">{gloss}</span>}
                      </button>
                    );
                  })
                : matches.map((w) => {
                    const wd = findWord(w);
                    const gloss = wd?.definitions?.[0] ?? "";
                    return (
                      <button
                        key={w}
                        className="sheet-saved-row"
                        type="button"
                        onClick={() => onOpenWord(w)}
                      >
                        <span className="sheet-saved-hanzi">{w}</span>
                        {wd?.pinyin && <span className="sheet-saved-pinyin">{wd.pinyin}</span>}
                        {gloss && <span className="sheet-saved-gloss">{gloss}</span>}
                      </button>
                    );
                  })}
            </div>
          </section>
        )}

        <section className="sheet-section">
          <div className="sheet-section-head">
            <span className="sheet-section-num">Nº {mnemonicNo}</span>
            <span className="sheet-section-name sheet-mnemonic-title">
              💡 MAKE IT STICK
              {editedFlag && <span className="mnemonic-saved-tag">your version</span>}
            </span>
            {editedFlag && (
              <button
                type="button"
                className="mnemonic-reset"
                onClick={resetMnemonic}
                title="Reset to the auto-suggested mnemonic"
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
              placeholder="Write a story, image, or hook that makes this stick…"
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
          href={`./network/?focus=${encodeURIComponent(key)}`}
          onClick={onClose}
        >
          Show in network →
        </a>
      </div>
    </div>
  );
}

// One-line frequency band for the corpus rank. The user asked: no HSK,
// but keep a hint. Ranges loosely follow the chinese-lexicon rank
// distribution. Mirrors the helper that used to live in WordDetail.
function commonnessLabel(rank: number | null | undefined): string | null {
  if (rank == null) return null;
  if (rank < 1000) return "Top 1 000";
  if (rank < 3000) return "Top 3 000";
  if (rank < 10000) return "Top 10 000";
  return "Less common";
}

// Reads the role palette from CSS (--role-* in :root / styles.css) so there's
// one source of truth — keep in step with the .role-* / .node-card.role-*
// rules and design-tokens.css.
function roleColor(type: string | undefined): string | undefined {
  switch (type) {
    case "sound":
      return "var(--role-sound)";
    case "meaning":
      return "var(--role-meaning)";
    case "iconic":
      return "var(--role-iconic)";
    default:
      return undefined;
  }
}
