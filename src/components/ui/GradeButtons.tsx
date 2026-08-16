import type { RatingName } from "../../lib/fsrs";

// The Again / Good / Easy button trio shared by CombinedRecognitionCard
// (meaning + sound rows) and ClusterRecallCard. Renders a fragment of
// `.review-btn` buttons — the caller supplies the wrapper
// (`.combined-grade-row` vs `.review-actions`) so each call site keeps
// its exact DOM.
//
// `locked` reproduces CombinedRecognitionCard's "both graded" state: a
// click neither records a grade nor stops propagation, so it bubbles up
// to the tap-anywhere-to-advance surface. When unlocked, the click is
// swallowed and `onPick` fires.

const DEFAULT_RATINGS: RatingName[] = ["Again", "Good", "Easy"];
// Owner-facing labels (v131): the FSRS rating names stay the data
// vocabulary, but the buttons describe the relationship with the word.
const DEFAULT_LABELS: Partial<Record<RatingName, string>> = {
  Again: "Didn't know",
  Good: "Know",
  Easy: "Confident",
};
const RATING_CLS: Record<RatingName, string> = {
  Again: "review-btn-again",
  Good: "review-btn-good",
  Easy: "review-btn-easy",
  Hard: "review-btn-skip",
};

interface Props {
  onPick: (rating: RatingName) => void;
  ratings?: RatingName[];
  labels?: Partial<Record<RatingName, string>>;
  picked?: RatingName | null;
  locked?: boolean;
}

export function GradeButtons({ onPick, ratings = DEFAULT_RATINGS, labels, picked, locked }: Props) {
  return (
    <>
      {ratings.map((r) => (
        <button
          key={r}
          type="button"
          className={`review-btn ${RATING_CLS[r]}${picked === r ? " is-picked" : ""}`}
          onClick={(e) => {
            if (locked) return;
            e.stopPropagation();
            onPick(r);
          }}
        >
          {labels?.[r] ?? DEFAULT_LABELS[r] ?? r}
        </button>
      ))}
    </>
  );
}
