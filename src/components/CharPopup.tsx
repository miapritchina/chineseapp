import { useEffect, useRef } from "react";
import type { Char, Word } from "../lib/types";

interface Props {
  char: string;
  charData: Char | undefined;
  saved: Set<string>;
  onToggleSave: (key: string) => void;
  onClose: () => void;
  onJumpToWord: (word: string) => void;
  findWord: (key: string) => Word | null;
}

export function CharPopup({ char, charData, saved, onToggleSave, onClose, onJumpToWord, findWord }: Props) {
  const writerRef = useRef<HTMLDivElement>(null);
  const writerInstanceRef = useRef<any>(null);

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

  const isSaved = saved.has(char);
  const matches = [...saved].filter((w) => w !== char && w.includes(char));

  return (
    <div className="popup-root" role="dialog" aria-modal="true" aria-label={`Details for ${char}`}>
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup-panel">
        <button className="popup-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <button
          className={`popup-star${isSaved ? " active" : ""}`}
          type="button"
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from saved" : "Save"}
          onClick={() => onToggleSave(char)}
        >
          {isSaved ? "★" : "☆"}
        </button>

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

        {matches.length > 0 && (
          <div className="popup-saved">
            <div className="popup-saved-title">In your saved words</div>
            <div className="popup-saved-chips">
              {matches.map((w) => {
                const word = findWord(w);
                return (
                  <button
                    key={w}
                    className="chip"
                    type="button"
                    onClick={() => {
                      onClose();
                      onJumpToWord(w);
                    }}
                  >
                    {word ? `${w} · ${word.pinyin}` : w}
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
