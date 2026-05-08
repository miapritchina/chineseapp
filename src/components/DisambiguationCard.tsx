import type { Char } from "../lib/types";

interface Props {
  // The character that just failed (or is about to surface) and triggered
  // the cluster check.
  focus: string;
  // Other cluster members to compare against.
  neighbors: string[];
  chars: Record<string, Char>;
  onContinue: () => void;
}

// Side-by-side compare view. Shown once per session when a card hits the
// leech threshold AND is in a known confusion cluster (see
// src/lib/confusionClusters.mjs). The contract is just informational —
// the user reads the contrast, then taps Continue and lands on the
// regular review prompt for the focus char. No grading happens here.
export function DisambiguationCard({ focus, neighbors, chars, onContinue }: Props) {
  const all = [focus, ...neighbors];
  return (
    <div className="disambig-root">
      <div className="disambig-banner">
        Confusable cluster — compare before answering.
      </div>
      <div className="disambig-grid">
        {all.map((c, i) => {
          const cd = chars[c];
          const gloss = (cd?.definitions || []).slice(0, 2).join("; ");
          return (
            <div
              key={c}
              className={`disambig-cell${i === 0 ? " is-focus" : ""}`}
            >
              <div className="disambig-cell-glyph">{c}</div>
              {cd?.pinyin && <div className="disambig-cell-pinyin">{cd.pinyin}</div>}
              {gloss && <div className="disambig-cell-gloss">{gloss}</div>}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="review-btn review-btn-reveal disambig-continue"
        onClick={onContinue}
      >
        Got it · continue
      </button>
    </div>
  );
}
