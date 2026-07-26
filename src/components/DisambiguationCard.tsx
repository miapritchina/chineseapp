import { Entity } from "./Entity";

interface Props {
  // The character that just failed (or is about to surface) and triggered
  // the cluster check.
  focus: string;
  // Other cluster members to compare against.
  neighbors: string[];
  onContinue: () => void;
  // Open the EntitySheet for a tapped cluster member.
  onOpenEntity?: (key: string) => void;
}

// Side-by-side compare view. Shown once per session when a card hits the
// leech threshold AND is in a known confusion cluster (see
// src/lib/confusionClusters.mjs). The contract is just informational —
// the user reads the contrast, then taps Continue and lands on the
// regular review prompt for the focus char. No grading happens here.
export function DisambiguationCard({ focus, neighbors, onContinue, onOpenEntity }: Props) {
  const all = [focus, ...neighbors];
  return (
    <div className="disambig-root">
      <div className="disambig-banner">Confusable cluster — compare before answering.</div>
      <div className="disambig-grid">
        {all.map((c, i) => (
          <Entity
            key={c}
            itemKey={c}
            size="sm"
            roleColor={i === 0 ? "var(--accent)" : undefined}
            ariaLabel={i === 0 ? `Focus: ${c}` : c}
            onTap={onOpenEntity ? () => onOpenEntity(c) : undefined}
          />
        ))}
      </div>
      <div className="disambig-actions">
        <button
          type="button"
          className="review-btn review-btn-reveal disambig-continue"
          onClick={onContinue}
        >
          Got it · continue
        </button>
      </div>
    </div>
  );
}
