import { useRef } from "react";
import type { Status } from "../hooks/useSaved";
import { usePopover } from "../hooks/usePopover";

const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  learned: "Learned",
  wrote: "Wrote",
  review: "Need to learn",
};

// v99 (ADR-0011): two selectable tiers. "wrote"/"review" remain in the
// Status type for legacy data mapping but are no longer offered.
const STATUS_ORDER: Status[] = ["saved", "learned"];

interface IconProps {
  status: Status | null;
  size?: number;
}

export function StatusIcon({ status, size = 22 }: IconProps) {
  if (status === "saved") return <Star filled size={size} className="status-icon-saved" />;
  if (status === "learned") return <Cap size={size} className="status-icon-learned" />;
  if (status === "wrote") return <Brush size={size} className="status-icon-wrote" />;
  if (status === "review") return <Bang size={size} className="status-icon-review" />;
  return <Star filled={false} size={size} className="status-icon-empty" />;
}

function Star({ filled, size, className }: { filled: boolean; size: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M12 2.5l2.95 6.5 7.05.55-5.4 4.7 1.65 6.95L12 17.7l-6.25 3.5 1.65-6.95L2 9.55l7.05-.55Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cap({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 L23 9 L12 15 L1 9 Z" />
      <path d="M5 11.4 L5 16 C5 16.9 8.2 18.2 12 18.2 C15.8 18.2 19 16.9 19 16 L19 11.4 L12 14.6 Z" />
      <path d="M21.6 9.4 L21.6 13.5 C21.6 14 22 14.4 22.4 14.4 C22.8 14.4 23.2 14 23.2 13.5 L23.2 9.4 Z" />
    </svg>
  );
}

function Brush({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.6 2.4 L21.6 7.4 L9.6 19.4 L4.6 14.4 Z" />
      <path d="M3 21 L8 16 L8.2 19.8 Z" opacity="0.85" />
    </svg>
  );
}

function Bang({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 C12.7 2 13.3 2.6 13.3 3.4 L12.8 14.5 C12.8 15 12.4 15.4 12 15.4 C11.6 15.4 11.2 15 11.2 14.5 L10.7 3.4 C10.7 2.6 11.3 2 12 2 Z" />
      <circle cx="12" cy="19.5" r="1.7" />
    </svg>
  );
}

interface Props {
  status: Status | null;
  // Optional label for the trigger; when undefined, just the icon.
  variant?: "icon" | "iconLg";
  // Called with the picked status, or null to remove.
  onChange: (next: Status | null) => void;
  // Override the default first-tap-saves behavior with a different default
  // (used by the SavedShelf where everything is already at least saved).
  defaultIfEmpty?: Status;
}

export function StatusButton({
  status,
  variant = "icon",
  onChange,
  defaultIfEmpty = "saved",
}: Props) {
  const { open, setOpen, ref: wrapperRef } = usePopover<HTMLDivElement>();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === null) {
      // First tap on an unsaved word: just save it. No menu.
      onChange(defaultIfEmpty);
    } else {
      setOpen((v) => !v);
    }
  };

  const handlePick = (next: Status | null) => {
    setOpen(false);
    onChange(next);
  };

  const iconSize = variant === "iconLg" ? 22 : 20;

  return (
    <div ref={wrapperRef} className="status-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className={`status-btn status-${status ?? "empty"}${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={status === null ? "Save" : `Status: ${STATUS_LABEL[status]} — tap to change`}
        title={status === null ? "Save to my words" : `${STATUS_LABEL[status]} · tap to change`}
        onClick={handleTriggerClick}
      >
        <StatusIcon status={status} size={iconSize} />
      </button>
      {open && (
        <div className="status-menu" role="menu">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className={`status-menu-item status-${s}${status === s ? " is-current" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handlePick(s);
              }}
            >
              <span className={`status-menu-icon status-icon-${s}`}>
                <StatusIcon status={s} size={18} />
              </span>
              <span className="status-menu-label">{STATUS_LABEL[s]}</span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="status-menu-item status-remove"
            onClick={(e) => {
              e.stopPropagation();
              handlePick(null);
            }}
          >
            <span className="status-menu-icon">
              <StatusIcon status={null} size={18} />
            </span>
            <span className="status-menu-label">Remove</span>
          </button>
        </div>
      )}
    </div>
  );
}
