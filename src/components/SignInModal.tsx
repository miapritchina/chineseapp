import { useState } from "react";

interface Props {
  onClose: () => void;
  onSignIn: (email: string) => Promise<{ error: string | null }>;
}

export function SignInModal({ onClose, onSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await onSignIn(email.trim());
    setSubmitting(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <div className="popup-root" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup-panel signin-panel">
        <button className="popup-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {sent ? (
          <div className="signin-sent">
            <div className="signin-title">Check your email</div>
            <div className="signin-body">
              We sent a sign-in link to <strong>{email}</strong>. Open it on this
              device to finish signing in.
            </div>
          </div>
        ) : (
          <form className="signin-form" onSubmit={send}>
            <div className="signin-title">Sign in</div>
            <div className="signin-body">
              We'll email you a one-tap link. No password.
            </div>
            <input
              type="email"
              autoFocus
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            <button className="signin-submit" type="submit" disabled={submitting || !email.trim()}>
              {submitting ? "Sending…" : "Send link"}
            </button>
            {error && <div className="signin-error">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
