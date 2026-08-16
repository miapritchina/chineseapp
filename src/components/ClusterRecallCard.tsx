import { useState } from "react";
import { speak, stopSpeech } from "../lib/speech";
import type { ClusterMemberResult } from "../lib/drillGen";
import { Entity } from "./Entity";

interface Props {
  // 3–4 related saved words (see buildClusters). Each member is graded
  // from what the user reports — missed members get Again, the rest
  // Good (useReview.gradeCluster; only rows due now are touched).
  cluster: string[];
  onGraded: (results: ClusterMemberResult[]) => void;
  // Open the EntitySheet for a revealed word (tap on the card itself).
  onOpenEntity?: (key: string) => void;
}

// Whole-cluster recall (Stern & Halamish 2023: recalling a small group
// of related words together beats reviewing them in isolation). v107:
// one cluster per card, mixed into the regular session queue like any
// other drill. Rebalance stage 1: the single group grade is gone —
// mark the words you missed via the ✗ chip, Continue grades each
// member individually.
export function ClusterRecallCard({ cluster, onGraded, onOpenEntity }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [missed, setMissed] = useState<Set<string>>(() => new Set());
  const allRevealed = cluster.every((w) => revealed.has(w));

  const toggleMissed = (w: string) => {
    setMissed((prev) => {
      const n = new Set(prev);
      if (n.has(w)) n.delete(w);
      else n.add(w);
      return n;
    });
  };

  return (
    <div className="phonetic-tap">
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Recall each, then tap to check</div>
        <div className="cluster-grid">
          {cluster.map((w) => {
            const isRevealed = revealed.has(w);
            const isMissed = missed.has(w);
            return (
              <div key={w} className="cluster-cell">
                <Entity
                  itemKey={w}
                  size="sm"
                  showPinyin={isRevealed}
                  showMeaning={isRevealed}
                  className={isMissed ? "is-wrong" : undefined}
                  roleColor={isRevealed && !isMissed ? "var(--accent)" : undefined}
                  ariaLabel={isRevealed ? `Revealed: ${w}` : `Tap to reveal ${w}`}
                  // First tap reveals; a tap on a revealed word opens
                  // its sheet. Marking a miss lives on the ✗ chip.
                  onTap={() => {
                    if (isRevealed) {
                      onOpenEntity?.(w);
                      return;
                    }
                    setRevealed((prev) => {
                      const n = new Set(prev);
                      n.add(w);
                      return n;
                    });
                    speak(w);
                  }}
                />
                {isRevealed && (
                  <button
                    type="button"
                    className={`cluster-miss-chip${isMissed ? " is-on" : ""}`}
                    aria-label={isMissed ? `${w}: marked missed` : `Mark ${w} as missed`}
                    aria-pressed={isMissed}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMissed(w);
                    }}
                  >
                    ✗
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {allRevealed ? (
          <>
            <div className="drill-tap-hint">Tap ✗ on the ones you didn’t know.</div>
            <div className="combined-grade-row">
              <button
                type="button"
                className="review-btn review-btn-good"
                onClick={() => {
                  stopSpeech();
                  onGraded(cluster.map((w) => ({ word: w, missed: missed.has(w) })));
                }}
              >
                {missed.size === 0 ? "Knew all" : `Continue (${missed.size} missed)`}
              </button>
            </div>
          </>
        ) : (
          <div className="drill-tap-hint">Tap each card to reveal its answer.</div>
        )}
      </div>
    </div>
  );
}
