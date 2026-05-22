import { useEffect, useMemo, useState } from "react";
import type { Char } from "../lib/types";
import type { Facet, ItemKind } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { speak } from "../lib/speech";
import { firstReading } from "../lib/speech";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import { usePhoneticComponents } from "../hooks/usePhoneticComponents";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";
import { GradeButtons } from "./ui/GradeButtons";

interface Props {
  // Apply a grade to every word in the cluster at once. Usually
  // wired through ReviewPage's grade() against the meaningRecognition
  // facet so the cluster recall counts toward the SRS schedule.
  onGrade: (itemKey: string, rating: RatingName, kind?: ItemKind, facet?: Facet) => void;
  onClose: () => void;
}

const TARGET_SIZE = 4;
const MIN_SIZE = 3;

// Pick a small "cluster" of related saved words for whole-cluster recall.
// Strategy, in order of preference:
//   1. Saved words that share a phonetic component (e.g. 请 + 情 + 清).
//   2. Saved words that share any common Han character.
//   3. Random sample of saved words.
// Returns at most TARGET_SIZE, at least MIN_SIZE, or null if the saved
// set is too small to form a cluster.
export function pickCluster(
  savedKeys: string[],
  chars: Record<string, Char>,
  phoneticComponentsByChar?: Map<string, PhoneticComponent>,
): string[] | null {
  if (savedKeys.length < MIN_SIZE) return null;

  // 1. Phonetic-component cluster.
  if (phoneticComponentsByChar) {
    for (const [comp, info] of phoneticComponentsByChar) {
      const family = new Set(info.family || []);
      family.add(comp);
      const matches = savedKeys.filter((w) => {
        for (const c of w) if (family.has(c)) return true;
        return false;
      });
      if (matches.length >= MIN_SIZE) {
        return matches.slice(0, TARGET_SIZE);
      }
    }
  }

  // 2. Shared-character cluster.
  const charCounts = new Map<string, string[]>();
  for (const w of savedKeys) {
    for (const c of new Set(w)) {
      const arr = charCounts.get(c) || [];
      arr.push(w);
      charCounts.set(c, arr);
    }
  }
  const shared = [...charCounts.entries()]
    .filter(([, ws]) => ws.length >= MIN_SIZE)
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (shared) {
    return shared[1].slice(0, TARGET_SIZE);
  }

  // 3. Random sample.
  const arr = savedKeys.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr.slice(0, TARGET_SIZE);
}

// Whole-cluster recall surface. Stern & Halamish 2023 finding: recalling
// a small cluster at once produced better delayed-test scores than
// reviewing each word in isolation. Brief calls this out as the right
// flow for the "weekly consolidation" use case.
export function ClusterRecall({ onGrade, onClose }: Props) {
  const { savedList } = useSavedCtx();
  const { findWord } = useDictCtx();
  const { chars } = useCharsCtx();
  const { byChar: phoneticComponentsByChar } = usePhoneticComponents();
  const cluster = useMemo(
    () =>
      pickCluster(
        savedList.map((s) => s.word),
        chars,
        phoneticComponentsByChar,
      ),
    [savedList, chars, phoneticComponentsByChar],
  );
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [graded, setGraded] = useState(false);

  useEffect(() => {
    setRevealed(new Set());
    setGraded(false);
  }, [cluster?.join("|")]);

  if (!cluster) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Cluster recall" progress="" />
        <EmptyState
          variant="review"
          title="Save a few more words first."
          hint={`Cluster recall needs at least ${MIN_SIZE} saved words to surface a related group.`}
        />
      </div>
    );
  }

  const allRevealed = cluster.every((w) => revealed.has(w));

  const grade = (rating: RatingName) => {
    for (const w of cluster) {
      // Apply to both meaning + sound facets so the cluster recall
      // touches both metrics.
      onGrade(w, rating, "word", "meaningRecognition");
      onGrade(w, rating, "word", "soundRecognition");
    }
    setGraded(true);
    // Brief moment to show feedback before kicking back to the launch
    // screen / saved shelf.
    setTimeout(onClose, 700);
  };

  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag="Cluster recall"
        progress={`${revealed.size} / ${cluster.length}`}
      />
      <div className="review-body cluster-body">
        <div className="cluster-prompt">
          Read each one. Try to recall its meaning and sound before tapping.
        </div>
        <div className="cluster-grid">
          {cluster.map((w) => {
            const word = findWord(w);
            const isRevealed = revealed.has(w);
            return (
              <button
                key={w}
                type="button"
                className={`cluster-cell${isRevealed ? " is-revealed" : ""}`}
                onClick={() => {
                  setRevealed((prev) => {
                    if (prev.has(w)) return prev;
                    const n = new Set(prev);
                    n.add(w);
                    return n;
                  });
                  speak(w);
                }}
              >
                <span className="cluster-cell-hanzi">{w}</span>
                {isRevealed && (
                  <>
                    <span className="cluster-cell-pinyin">{firstReading(word?.pinyin || "")}</span>
                    <span className="cluster-cell-gloss">
                      {(word?.definitions || []).slice(0, 2).join("; ")}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="review-actions">
        {allRevealed && !graded ? (
          <GradeButtons
            onPick={grade}
            labels={{ Again: "Need work", Good: "Knew most", Easy: "Knew all" }}
          />
        ) : graded ? (
          <div className="review-empty-hint">Logged for all {cluster.length}.</div>
        ) : (
          <div className="review-empty-hint">Tap each card to reveal its answer.</div>
        )}
      </div>
    </div>
  );
}
