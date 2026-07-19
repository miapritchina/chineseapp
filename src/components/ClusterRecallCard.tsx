import { useState } from "react";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { GradeButtons } from "./ui/GradeButtons";
import { Entity } from "./Entity";

interface Props {
  // 3–4 related saved words (see buildClusters). One grade covers the
  // whole group — the parent applies it to every word's recognition
  // rows.
  cluster: string[];
  onGraded: (rating: RatingName) => void;
}

// Whole-cluster recall (Stern & Halamish 2023: recalling a small group
// of related words together beats reviewing them in isolation). v107:
// one cluster per card, mixed into the regular session queue like any
// other drill.
export function ClusterRecallCard({ cluster, onGraded }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const allRevealed = cluster.every((w) => revealed.has(w));

  return (
    <div className="phonetic-tap">
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">
          Related words — recall meaning and sound before tapping each one.
        </div>
        <div className="cluster-grid">
          {cluster.map((w) => {
            const isRevealed = revealed.has(w);
            return (
              <Entity
                key={w}
                itemKey={w}
                size="sm"
                showPinyin={isRevealed}
                showMeaning={isRevealed}
                roleColor={isRevealed ? "var(--accent)" : undefined}
                ariaLabel={isRevealed ? `Revealed: ${w}` : `Tap to reveal ${w}`}
                onTap={() => {
                  setRevealed((prev) => {
                    if (prev.has(w)) return prev;
                    const n = new Set(prev);
                    n.add(w);
                    return n;
                  });
                  speak(w);
                }}
              />
            );
          })}
        </div>
        {allRevealed ? (
          <div className="combined-grade-row">
            <GradeButtons
              onPick={(r) => {
                stopSpeech();
                onGraded(r);
              }}
              labels={{ Again: "Need work", Good: "Knew most", Easy: "Knew all" }}
            />
          </div>
        ) : (
          <div className="drill-tap-hint">Tap each card to reveal its answer.</div>
        )}
      </div>
    </div>
  );
}
