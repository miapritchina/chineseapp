import { useMemo } from "react";
import type { Char, ModalEntry, Word } from "../lib/types";
import { buildCharTree, buildWordTree } from "../lib/tree";
import { DecompositionTree } from "./DecompositionTree";
import { StatusButton } from "./StatusButton";
import type { Status } from "../hooks/useSaved";

interface Props {
  entry: ModalEntry;
  word: Word | null;
  chars: Record<string, Char>;
  stackLen: number;
  saved: Set<string>;
  getStatus: (key: string) => Status | null;
  setStatus: (key: string, next: Status | null) => void;
  onPop: () => void;
  onNodeClick: (char: string) => void;
}

// Full recursive decomposition tree (d3) page. Reached from the
// "⤢ full tree" affordance inside EntitySheet. The lighter detail
// (definitions, etymology blurb, mnemonic) lives in the sheet now;
// this view is just the zoomable role-tinted tree.
export function TreeModal({
  entry,
  word,
  chars,
  stackLen,
  saved,
  getStatus,
  setStatus,
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

  return (
    <div className="modal-root open" aria-hidden="false">
      <div className="modal-header">
        <button className="back-btn" type="button" onClick={onPop}>
          {stackLen > 1 ? "← Back" : "← Close"}
        </button>
        <h2 className="modal-title">
          {titleHanzi}
          {titlePinyin && <span className="title-pinyin">{titlePinyin}</span>}
        </h2>
        <div className="header-actions">
          <StatusButton
            status={getStatus(entry.key)}
            variant="iconLg"
            onChange={(next) => setStatus(entry.key, next)}
          />
        </div>
      </div>
      <div className="modal-body">
        {tree ? (
          <DecompositionTree tree={tree} chars={chars} saved={saved} onNodeClick={onNodeClick} />
        ) : (
          <p style={{ padding: 24 }}>Unknown {entry.kind}: {entry.key}</p>
        )}
      </div>
    </div>
  );
}
