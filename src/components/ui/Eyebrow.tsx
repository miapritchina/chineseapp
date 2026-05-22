import type { ReactNode } from "react";

// Mono uppercase micro-label (the `Nº 01 · ETYMOLOGY` / kind-tag family).
// Defaults to the review kind-tag class; pass `className` to reuse a more
// specific existing style (e.g. `sheet-eyebrow`, `launch-section-title`).
interface Props {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className = "review-kind-tag" }: Props) {
  return <span className={className}>{children}</span>;
}
