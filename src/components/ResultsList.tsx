import type { Word } from "../lib/types";
import type { Status } from "../hooks/useSaved";
import { StatusButton } from "./StatusButton";
import { hanziScaleStyle } from "../lib/hanzi";

interface Props {
  matches: Word[];
  saved: Set<string>;
  onOpen: (word: string) => void;
  // Optional status controls. When present, each row gets a
  // StatusButton in the trailing slot so the user can save / promote
  // a result without opening the modal first.
  getStatus?: (key: string) => Status | null;
  setStatus?: (key: string, next: Status | null) => void;
}

export function ResultsList({ matches, saved, onOpen, getStatus, setStatus }: Props) {
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
        const status = getStatus ? getStatus(w.word) : undefined;
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
            {getStatus && setStatus ? (
              <div className="r-status" onClick={(e) => e.stopPropagation()}>
                <StatusButton
                  status={status ?? null}
                  onChange={(next) => setStatus(w.word, next)}
                />
              </div>
            ) : (
              saved.has(w.word) && (
                <span
                  className="r-saved"
                  aria-label="In your saved list"
                  title="Saved"
                >
                  ★
                </span>
              )
            )}
          </div>
        );
      })}
    </section>
  );
}
