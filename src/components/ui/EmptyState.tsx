// Empty / loading message. `variant="review"` uses the review surface's
// title+hint treatment (`.review-empty`); the default is the lighter
// inline `.empty-state` used by search results and the phonetics list.
interface Props {
  title?: string;
  hint?: string;
  variant?: "review" | "inline";
}

export function EmptyState({ title, hint, variant = "inline" }: Props) {
  if (variant === "review") {
    return (
      <div className="review-empty">
        {title && <div className="review-empty-title">{title}</div>}
        {hint && <div className="review-empty-hint">{hint}</div>}
      </div>
    );
  }
  return (
    <div className="empty-state">
      {title}
      {title && hint ? " " : null}
      {hint}
    </div>
  );
}
