import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

// Shared chrome for a review drill: header (back + tag + progress +
// Skip), the thin progress fill, and a body slot. Extracted from the
// inline DrillFrame in ReviewPage so every drill surface shares one
// frame. `progressIndex` is the 1-based position of the current card.
interface Props {
  tag: string;
  progressIndex: number;
  total: number;
  onClose: () => void;
  onSkip: () => void;
  children: ReactNode;
}

export function DrillShell({ tag, progressIndex, total, onClose, onSkip, children }: Props) {
  const pct = total > 0 ? Math.min(100, Math.max(0, ((progressIndex - 1) / total) * 100)) : 0;
  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag={tag}
        progress={`${progressIndex} / ${total}`}
        onSkip={onSkip}
      />
      <div
        className="review-progress-bar"
        role="progressbar"
        aria-valuenow={Math.max(0, progressIndex - 1)}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="review-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="review-body">{children}</div>
    </div>
  );
}
