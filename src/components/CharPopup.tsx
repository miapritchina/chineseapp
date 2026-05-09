import { useEffect, useRef, useState } from "react";
import type { Char, Word } from "../lib/types";
import { StatusButton } from "./StatusButton";
import type { Status } from "../hooks/useSaved";
import {
  buildStarterMnemonic,
  clearMnemonic,
  loadMnemonic,
  saveMnemonic,
} from "../lib/mnemonics";

interface Props {
  char: string;
  charData: Char | undefined;
  saved: Set<string>;
  getStatus: (key: string) => Status | null;
  setStatus: (key: string, next: Status | null) => void;
  onClose: () => void;
  onJumpToWord: (word: string) => void;
  findWord: (key: string) => Word | null;
}

export function CharPopup({ char, charData, saved, getStatus, setStatus, onClose, onJumpToWord, findWord }: Props) {
  const writerRef = useRef<HTMLDivElement>(null);
  const writerInstanceRef = useRef<any>(null);

  // "💡 Make it stick" — self-generated mnemonic encoding (Kuo & Hooper).
  // Pre-populated from the role tree on first open; user can edit or
  // accept. Edited state is persisted in localStorage.
  const starter = buildStarterMnemonic(char, charData);
  const [mnemonic, setMnemonic] = useState<string>(() => {
    const stored = loadMnemonic(char);
    return stored?.text ?? starter;
  });
  const [editedFlag, setEditedFlag] = useState<boolean>(() => {
    return !!loadMnemonic(char)?.edited;
  });
  const [mnemonicEditing, setMnemonicEditing] = useState(false);
  // Reload when the popup switches to a different char (component
  // instance is reused).
  useEffect(() => {
    const stored = loadMnemonic(char);
    setMnemonic(stored?.text ?? buildStarterMnemonic(char, charData));
    setEditedFlag(!!stored?.edited);
    setMnemonicEditing(false);
  }, [char, charData]);

  const persistMnemonic = (text: string) => {
    if (text === starter && !editedFlag) {
      // Untouched default — don't bloat storage.
      clearMnemonic(char);
      return;
    }
    saveMnemonic(char, text);
    setEditedFlag(true);
  };
  const resetToDefault = () => {
    clearMnemonic(char);
    setMnemonic(starter);
    setEditedFlag(false);
    setMnemonicEditing(false);
  };

  // Mount hanzi-writer once per char.
  useEffect(() => {
    const el = writerRef.current;
    if (!el) return;
    el.innerHTML = "";
    const HW = (window as any).HanziWriter;
    if (typeof HW === "undefined") {
      const fallback = document.createElement("div");
      fallback.className = "popup-writer-fallback";
      fallback.textContent = char;
      el.appendChild(fallback);
      return;
    }
    try {
      const size = Math.min(280, el.clientWidth || 280);
      const writer = HW.create(el, char, {
        width: size,
        height: size,
        padding: 6,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 120,
        strokeColor:
          getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222",
        outlineColor:
          getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#ddd",
        onLoadCharDataError: () => {
          el.innerHTML = "";
          const fb = document.createElement("div");
          fb.className = "popup-writer-fallback";
          fb.textContent = char;
          el.appendChild(fb);
        },
      });
      writerInstanceRef.current = writer;
      writer.animateCharacter();
    } catch (err) {
      console.error("HanziWriter error for", char, err);
      const fb = document.createElement("div");
      fb.className = "popup-writer-fallback";
      fb.textContent = char;
      el.appendChild(fb);
    }
    return () => {
      writerInstanceRef.current = null;
    };
  }, [char]);

  const replay = () => writerInstanceRef.current?.animateCharacter();

  const matches = [...saved].filter((w) => w !== char && w.includes(char));

  return (
    <div className="popup-root" role="dialog" aria-modal="true" aria-label={`Details for ${char}`}>
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup-panel">
        <button className="popup-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="popup-status">
          <StatusButton
            status={getStatus(char)}
            onChange={(next) => setStatus(char, next)}
          />
        </div>

        {charData?.pinyin && <div className="popup-pinyin">{charData.pinyin}</div>}

        <div
          ref={writerRef}
          className="popup-writer"
          role="button"
          tabIndex={0}
          aria-label={`Replay stroke animation for ${char}`}
          onClick={replay}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              replay();
            }
          }}
        />

        {charData?.definitions?.length ? (
          <div className="popup-meaning">{charData.definitions.join("; ")}</div>
        ) : (
          <div className="popup-meaning popup-muted">No dictionary entry.</div>
        )}

        {charData?.originalMeaning && charData.originalMeaning !== "characterless component" && (
          <div className="popup-orig">Originally: {charData.originalMeaning}</div>
        )}
        {charData?.notes && <div className="popup-etym">{charData.notes}</div>}

        <div className="mnemonic-block">
          <div className="mnemonic-header">
            <span className="mnemonic-title">
              💡 Make it stick {editedFlag && <span className="mnemonic-saved-tag">your version</span>}
            </span>
            {editedFlag && (
              <button
                type="button"
                className="mnemonic-reset"
                onClick={resetToDefault}
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
                if (e.key === "Escape") {
                  setMnemonicEditing(false);
                }
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
        </div>

        <a
          className="popup-open-tree"
          role="button"
          href={`./network/?focus=${encodeURIComponent(char)}`}
          onClick={onClose}
        >
          Show in network →
        </a>

        {matches.length > 0 && (
          <div className="popup-saved">
            <div className="popup-saved-title">In your saved words</div>
            <div className="popup-saved-list">
              {matches.map((w) => {
                const word = findWord(w);
                const gloss = word?.definitions?.[0] ?? "";
                return (
                  <button
                    key={w}
                    className="chip-row"
                    type="button"
                    onClick={() => {
                      onClose();
                      onJumpToWord(w);
                    }}
                  >
                    <span className="chip-row-hanzi">{w}</span>
                    {word?.pinyin && <span className="chip-row-pinyin">{word.pinyin}</span>}
                    {gloss && <span className="chip-row-gloss">{gloss}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
