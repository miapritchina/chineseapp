import type { Word } from "../lib/types";
import { StatusButton } from "./StatusButton";
import { hanziScaleStyle } from "../lib/hanzi";
import { useSavedCtx } from "../state/contexts";

interface Props {
  matches: Word[];
  onOpen: (word: string) => void;
}

export function ResultsList({ matches, onOpen }: Props) {
  const { saved, getStatus, setStatus } = useSavedCtx();
  if (matches.length === 0) {
    return <div className="empty-state">No matches.</div>;
  }
  // Saved words first, then the rest. Within each group the RPC's tier
  // ordering is preserved (Array.prototype.sort is stable in ES2019+).
  const ordered = [...matches].sort((a, b) => {
    const sa = saved.has(a.word) ? 0 : 1;
    const sb = saved.has(b.word) ? 0 : 1;
    return sa - sb;
  });
  return (
    <section className="results" aria-label="Search results">
      {ordered.map((w) => {
        const status = getStatus(w.word);
        return (
          <div
            key={w.word}
            className="result-row"
            style={hanziScaleStyle(w.simp)}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(w.word)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(w.word);
              }
            }}
          >
            <div className="r-hanzi">{w.simp}</div>
            <div className="r-mid">
              <div className="r-pinyin">{w.pinyin}</div>
              <div className="r-gloss">{(w.definitions || []).join("; ")}</div>
            </div>
            <div className="r-status" onClick={(e) => e.stopPropagation()}>
              <StatusButton status={status} onChange={(next) => setStatus(w.word, next)} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
