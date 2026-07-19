import { usePopover } from "../hooks/usePopover";

interface Props {
  version: string;
  // null means the link is shown but disabled (placeholder for future pages).
  reviewHref?: string | null;
  reviewBadge?: number;
  phoneticsHref?: string | null;
  classicHref?: string | null;
  onShareWords?: () => void;
  wordCount?: number;
}

// Hamburger menu in the top bar's left slot. Holds page navigation + the
// app version. Outside-click and Escape both dismiss. Pattern lifted from
// the StatusButton popover.
export function HamburgerMenu({
  version,
  reviewHref = null,
  reviewBadge = 0,
  phoneticsHref,
  classicHref = null,
  onShareWords,
  wordCount = 0,
}: Props) {
  const { open, setOpen, ref: wrapperRef } = usePopover<HTMLDivElement>();

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
      <div className={`hamburger-menu${open ? " is-open" : ""}`} role="menu" aria-hidden={!open}>
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
        {classicHref && (
          <a
            role="menuitem"
            className="hamburger-item"
            href={classicHref}
            onClick={() => setOpen(false)}
          >
            <span>三字经 · Classic</span>
          </a>
        )}
        <a role="menuitem" className="hamburger-item" href="./network/">
          <span>Network</span>
        </a>
        <a role="menuitem" className="hamburger-item" href="./components/">
          <span>Components</span>
        </a>
        {onShareWords && (
          <button
            type="button"
            role="menuitem"
            className="hamburger-item"
            onClick={() => {
              onShareWords();
              setOpen(false);
            }}
          >
            <span>Share my words</span>
            {wordCount > 0 && <span className="hamburger-soon">{wordCount}</span>}
          </button>
        )}
        <div className="hamburger-divider" />
        <div className="hamburger-version">{version}</div>
      </div>
    </div>
  );
}
