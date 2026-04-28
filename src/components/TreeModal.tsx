import { useMemo } from "react";
import type { Char, ModalEntry, Word } from "../lib/types";
import { buildCharTree, buildWordTree } from "../lib/tree";
import { DecompositionTree } from "./DecompositionTree";

interface Props {
  entry: ModalEntry;
  word: Word | null;
  chars: Record<string, Char>;
  stackLen: number;
  saved: Set<string>;
  learned: Set<string>;
  onToggleSave: (key: string) => void;
  onToggleLearned: (key: string) => void;
  onPop: () => void;
  onNodeClick: (char: string) => void;
}

export function TreeModal({
  entry,
  word,
  chars,
  stackLen,
  saved,
  learned,
  onToggleSave,
  onToggleLearned,
  onPop,
  onNodeClick,
}: Props) {
  const tree = useMemo(() => {
    if (entry.kind === "word") {
      if (!word) return null;
      return buildWordTree(word, chars);
    }
    return buildCharTree(entry.key, chars);
  }, [entry, word, chars]);

  const titleHanzi = entry.kind === "word" ? word?.simp ?? entry.key : entry.key;
  const titlePinyin =
    entry.kind === "word" ? word?.pinyin ?? "" : chars[entry.key]?.pinyin ?? "";
  const hsk = entry.kind === "word" ? word?.hsk ?? null : null;
  const isSaved = saved.has(entry.key);
  const isLearned = learned.has(entry.key);

  return (
    <div className="modal-root open" aria-hidden="false">
      <div className="modal-header">
        <button className="back-btn" type="button" onClick={onPop}>
          {stackLen > 1 ? "← Back" : "← Close"}
        </button>
        <h2 className="modal-title">
          {titleHanzi}
          {titlePinyin && <span className="title-pinyin">{titlePinyin}</span>}
          {hsk != null && <span className="title-hsk">HSK {hsk}</span>}
        </h2>
        <div className="header-actions">
          <button
            className={`header-grad${isLearned ? " active" : ""}`}
            type="button"
            aria-pressed={isLearned}
            aria-label={isLearned ? "Mark as not learned" : "Mark as learned"}
            title={isLearned ? "Learned · tap to unmark" : "Mark as learned"}
            onClick={() => onToggleLearned(entry.key)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              {/* mortarboard top diamond */}
              <path d="M12 3 L23 9 L12 15 L1 9 Z" />
              {/* cap base / band below */}
              <path d="M5 11.4 L5 16 C5 16.9 8.2 18.2 12 18.2 C15.8 18.2 19 16.9 19 16 L19 11.4 L12 14.6 Z" />
              {/* tassel */}
              <path d="M21.6 9.4 L21.6 13.5 C21.6 14 22 14.4 22.4 14.4 C22.8 14.4 23.2 14 23.2 13.5 L23.2 9.4 Z" />
            </svg>
          </button>
          <button
            className={`header-star${isSaved ? " active" : ""}`}
            type="button"
            aria-pressed={isSaved}
            aria-label={isSaved ? "Remove from saved" : "Save"}
            title={isSaved ? "Saved · tap to remove" : "Save to my words"}
            onClick={() => onToggleSave(entry.key)}
          >
            {isSaved ? "★" : "☆"}
          </button>
        </div>
      </div>
      <div className="modal-body">
        {tree ? (
          <DecompositionTree tree={tree} chars={chars} onNodeClick={onNodeClick} />
        ) : (
          <p style={{ padding: 24 }}>Unknown {entry.kind}: {entry.key}</p>
        )}
      </div>
    </div>
  );
}
