import { useEffect, useRef, useState } from "react";

interface Props {
  version: string;
  // null means the link is shown but disabled (placeholder for future pages).
  reviewHref?: string | null;
  reviewBadge?: number;
  phoneticsHref?: string | null;
  sentenceHref?: string | null;
}

// Hamburger menu in the top bar's left slot. Holds page navigation + the
// app version. Outside-click and Escape both dismiss. Pattern lifted from
// the StatusButton popover.
export function HamburgerMenu({
  version,
  reviewHref = null,
  reviewBadge = 0,
  phoneticsHref = null,
  sentenceHref = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="hamburger-wrapper">
      <button
        type="button"
        className={`hamburger-btn${open ? " is-open" : ""}`}
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {/* Always rendered; toggled via .is-open (visibility/opacity/
          transform) so dismissing doesn't yank a box out of layout. */}
      <div
        className={`hamburger-menu${open ? " is-open" : ""}`}
        role="menu"
        aria-hidden={!open}
      >
          {reviewHref ? (
            <a
              role="menuitem"
              className="hamburger-item"
              href={reviewHref}
              onClick={() => setOpen(false)}
            >
              <span>Review</span>
              {reviewBadge > 0 && <span className="hamburger-badge">{reviewBadge}</span>}
            </a>
          ) : (
            <span
              role="menuitem"
              className="hamburger-item is-disabled"
              aria-disabled="true"
              title="Review (coming soon)"
            >
              <span>Review</span>
              <span className="hamburger-soon">soon</span>
            </span>
          )}
          {phoneticsHref && (
            <a
              role="menuitem"
              className="hamburger-item"
              href={phoneticsHref}
              onClick={() => setOpen(false)}
            >
              <span>Phonetics</span>
            </a>
          )}
          {sentenceHref && (
            <a
              role="menuitem"
              className="hamburger-item"
              href={sentenceHref}
              onClick={() => setOpen(false)}
            >
              <span>Sentence</span>
            </a>
          )}
          <a role="menuitem" className="hamburger-item" href="./network/">
            <span>Network</span>
          </a>
          <a role="menuitem" className="hamburger-item" href="./components/">
            <span>Components</span>
          </a>
          <div className="hamburger-divider" />
          <div className="hamburger-version">{version}</div>
      </div>
    </div>
  );
}
