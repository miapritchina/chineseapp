import type { ReactNode } from "react";

// Shared full-screen-page header: back button (left) + optional tag
// (center) + optional progress or actions (right). Emits the existing
// `.review-header` / `.back-btn` / `.review-kind-tag` / `.review-progress`
// classes so it's a drop-in for the markup duplicated across ReviewPage,
// PhoneticsPage, and the DrillFrame.
interface Props {
  onBack: () => void;
  backLabel?: string;
  tag?: ReactNode;
  progress?: ReactNode;
  actions?: ReactNode;
  // Renders a Skip button next to the progress. Lives in the header —
  // out of the thumb zone — so it can't be hit by mistake while
  // grading (owner request, v105).
  onSkip?: () => void;
}

export function PageHeader({
  onBack,
  backLabel = "← Done",
  tag,
  progress,
  actions,
  onSkip,
}: Props) {
  return (
    <div className="review-header">
      <button className="back-btn" type="button" onClick={onBack}>
        {backLabel}
      </button>
      {tag != null && <span className="review-kind-tag">{tag}</span>}
      {actions != null ? (
        <div className="header-actions">{actions}</div>
      ) : onSkip ? (
        <div className="header-actions">
          <span className="review-progress">{progress}</span>
          <button type="button" className="drill-skip drill-skip-header" onClick={onSkip}>
            Skip
          </button>
        </div>
      ) : (
        <span className="review-progress">{progress}</span>
      )}
    </div>
  );
}
