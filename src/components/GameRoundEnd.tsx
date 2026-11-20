import { PageHeader } from "./ui/PageHeader";

interface Props {
  tag: string;
  title: string;
  hint?: string;
  // Absent when there is nothing left to play.
  onAgain?: () => void;
  onClose: () => void;
}

// End of a short game round (v166): the result, then one more round or
// home. Rounds end on purpose — a finite game is easier to start.
export function GameRoundEnd({ tag, title, hint, onAgain, onClose }: Props) {
  return (
    <div className="review-root">
      <PageHeader onBack={onClose} tag={tag} progress="" />
      <div className="chain-body">
        <div className="forge-end">
          <div className="forge-end-title">{title}</div>
          {hint && <div className="chain-reveal">{hint}</div>}
          {onAgain && (
            <button type="button" className="review-btn review-btn-reveal" onClick={onAgain}>
              Another round
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
