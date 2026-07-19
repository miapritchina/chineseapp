import { useMemo, useState } from "react";
import type { Facet, ItemKind } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";
import { speak } from "../lib/speech";
import { useSavedCtx } from "../state/contexts";
import { usePhoneticComponents } from "../hooks/usePhoneticComponents";
import { buildClusters } from "../lib/drillGen";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";
import { GradeButtons } from "./ui/GradeButtons";
import { Entity } from "./Entity";

interface Props {
  // Apply a grade to every word in the cluster at once (both
  // recognition facets, so it counts toward the SRS schedule).
  onGrade: (itemKey: string, rating: RatingName, kind?: ItemKind, facet?: Facet) => void;
  onClose: () => void;
}

// Whole-cluster recall (Stern & Halamish 2023: recalling a small group
// of related words together beats reviewing them in isolation). v103:
// one launch walks EVERY cluster the saved set can form — phonetic
// families first, then shared-character groups, then random fill —
// instead of showing a single (and previously always the same) group.
export function ClusterRecall({ onGrade, onClose }: Props) {
  const { savedList } = useSavedCtx();
  const { byChar: phoneticComponentsByChar } = usePhoneticComponents();
  const clusters = useMemo(
    () =>
      buildClusters(
        savedList.map((s) => s.word),
        phoneticComponentsByChar,
      ),
    [savedList, phoneticComponentsByChar],
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const cluster = clusters[index];

  if (!cluster) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Cluster recall" progress="" />
        <EmptyState
          variant="review"
          title={index === 0 ? "Save a few more words first." : "All clusters done."}
          hint={
            index === 0
              ? "Cluster recall needs at least 3 saved words to form a related group."
              : `Recalled ${index} cluster${index === 1 ? "" : "s"} this session.`
          }
        />
      </div>
    );
  }

  const allRevealed = cluster.every((w) => revealed.has(w));

  const grade = (rating: RatingName) => {
    for (const w of cluster) {
      onGrade(w, rating, "word", "meaningRecognition");
      onGrade(w, rating, "word", "soundRecognition");
    }
    setRevealed(new Set());
    setIndex((i) => i + 1);
  };

  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag="Cluster recall"
        progress={`${index + 1} / ${clusters.length}`}
      />
      <div className="review-body cluster-body">
        <div className="cluster-prompt">
          Read each one. Try to recall its meaning and sound before tapping.
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
      </div>
      <div className="review-actions">
        {allRevealed ? (
          <GradeButtons
            onPick={grade}
            labels={{ Again: "Need work", Good: "Knew most", Easy: "Knew all" }}
          />
        ) : (
          <div className="review-empty-hint">Tap each card to reveal its answer.</div>
        )}
      </div>
    </div>
  );
}
