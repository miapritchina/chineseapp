import type { ReactNode } from "react";
import { BugReportButton } from "../BugReportButton";
import { DrillHelp } from "./DrillHelp";

// Shared full-screen-page header: back button (left) + optional tag
// (center) + optional progress or actions (right). Emits the existing
// `.review-header` / `.back-btn` / `.review-kind-tag` / `.review-progress`
// classes so it's a drop-in for the markup duplicated across ReviewPage,
// ExplorePage, and the DrillFrame. The bug-report icon rides the right
// cluster so it's reachable from every full-screen surface (the hamburger
// isn't — it's covered by these pages).
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
  // Per-drill instructions behind a "?" popover in the header. Replaces
  // the old transient on-card "tap to …" hints (owner request, v150).
  help?: ReactNode;
}

export function PageHeader({
  onBack,
  backLabel = "← Done",
  tag,
  progress,
  actions,
  onSkip,
  help,
}: Props) {
  return (
    <div className="review-header">
      <button className="back-btn" type="button" onClick={onBack}>
        {backLabel}
      </button>
      {tag != null && <span className="review-kind-tag">{tag}</span>}
      <div className="header-actions header-right">
        {actions != null ? (
          actions
        ) : onSkip ? (
          <>
            <span className="review-progress">{progress}</span>
            <button type="button" className="drill-skip drill-skip-header" onClick={onSkip}>
              Skip
            </button>
          </>
        ) : progress != null ? (
          <span className="review-progress">{progress}</span>
        ) : null}
        {help != null && <DrillHelp>{help}</DrillHelp>}
        <BugReportButton className="header-bug" />
      </div>
    </div>
  );
}
