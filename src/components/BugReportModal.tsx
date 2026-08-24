import { useState } from "react";
import { useBugReport } from "../hooks/useBugReport";
import type { BugContext } from "../lib/bugReport";

interface Props {
  context: BugContext;
  userId: string | null;
  onClose: () => void;
}

// "Report a bug" form. The note is the only thing the user types; everything
// else (page, active character, version, device, time) is captured
// automatically so a report needs no screenshot.
export function BugReportModal({ context, userId, onClose }: Props) {
  const [note, setNote] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const { status, submit } = useBugReport(userId);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() || status === "sending") return;
    const ok = await submit(note.trim(), context);
    if (ok) setTimeout(onClose, 900);
  };

  if (status === "sent") {
    return (
      <div className="popup-root" role="dialog" aria-modal="true" aria-label="Bug report sent">
        <div className="popup-backdrop" onClick={onClose} />
        <div className="popup-panel signin-panel">
          <div className="signin-title">Thanks — sent ✓</div>
          <div className="signin-body">Your report landed. No screenshot needed.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-root" role="dialog" aria-modal="true" aria-label="Report a bug">
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup-panel signin-panel">
        <button className="popup-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <form className="signin-form" onSubmit={send}>
          <div className="signin-title">Report a bug</div>
          <div className="signin-body">
            What went wrong? We&rsquo;ll attach where you are automatically.
          </div>
          <textarea
            className="bugreport-note"
            autoFocus
            required
            rows={4}
            placeholder="e.g. the tree card overlaps the pinyin on this character"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={status === "sending"}
          />

          <button
            type="button"
            className="bugreport-details-toggle"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "▾" : "▸"} What gets attached
          </button>
          {showDetails && (
            <dl className="bugreport-context">
              <dt>Page</dt>
              <dd>{context.page}</dd>
              {context.entity && (
                <>
                  <dt>Item</dt>
                  <dd>{context.entity}</dd>
                </>
              )}
              <dt>Version</dt>
              <dd>{context.version}</dd>
              <dt>Screen</dt>
              <dd>{context.viewport}</dd>
              <dt>Device</dt>
              <dd className="bugreport-ua">{context.userAgent}</dd>
            </dl>
          )}

          <button
            className="signin-submit"
            type="submit"
            disabled={status === "sending" || !note.trim()}
          >
            {status === "sending" ? "Sending…" : "Send report"}
          </button>
          {status === "error" && (
            <div className="signin-error">
              Couldn&rsquo;t send — check your connection and retry.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
