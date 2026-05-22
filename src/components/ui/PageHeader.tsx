import type { ReactNode } from "react";

// Shared full-screen-page header: back button (left) + optional tag
// (center) + optional progress or actions (right). Emits the existing
// `.review-header` / `.back-btn` / `.review-kind-tag` / `.review-progress`
// classes so it's a drop-in for the markup duplicated across ReviewPage,
// PhoneticsPage, ClusterRecall, and the DrillFrame.
interface Props {
  onBack: () => void;
  backLabel?: string;
  tag?: ReactNode;
  progress?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ onBack, backLabel = "← Done", tag, progress, actions }: Props) {
  return (
    <div className="review-header">
      <button className="back-btn" type="button" onClick={onBack}>
        {backLabel}
      </button>
      {tag != null && <span className="review-kind-tag">{tag}</span>}
      {actions != null ? (
        <div className="header-actions">{actions}</div>
      ) : (
        <span className="review-progress">{progress}</span>
      )}
    </div>
  );
}
