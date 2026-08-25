import { useEffect, useRef, useState, type ReactNode } from "react";

// A persistent "?" affordance for the drill header. Replaces the old
// transient on-card hints ("Tap anywhere to reveal / continue …") that
// flickered in and out on every reveal — the owner wanted no
// unnecessary moving text on the drill surface. The instructions now
// live one tap away, per-drill, and only when asked for.
export function DrillHelp({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as HTMLElement)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="drill-help" ref={wrapRef}>
      <button
        type="button"
        className="drill-help-btn"
        aria-label="How this works"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div className="drill-help-pop" role="dialog" aria-label="How this works">
          {children}
        </div>
      )}
    </div>
  );
}
