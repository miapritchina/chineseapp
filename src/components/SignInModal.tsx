import { useState } from "react";

interface Props {
  onClose: () => void;
  onSignIn: (email: string) => Promise<{ error: string | null }>;
  onVerifyCode: (email: string, code: string) => Promise<{ error: string | null }>;
}

export function SignInModal({ onClose, onSignIn, onVerifyCode }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
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
    else {
      setSent(true);
      setCode("");
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await onVerifyCode(email.trim(), code);
    setSubmitting(false);
    // On success the auth state change closes the modal from App.
    if (err) setError(err);
  };

  return (
    <div className="popup-root" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="popup-backdrop" onClick={onClose} />
      <div className="popup-panel signin-panel">
        <button className="popup-close" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {sent ? (
          <form className="signin-form" onSubmit={verify}>
            <div className="signin-title">Enter your code</div>
            <div className="signin-body">
              We emailed a sign-in code to <strong>{email}</strong>. Type it here to finish signing
              in.
            </div>
            {/* Supabase OTP length is a project setting (6–10 digits) —
                don't assume 6. */}
            <input
              type="text"
              autoFocus
              required
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              autoComplete="one-time-code"
              placeholder="12345678"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={submitting}
            />
            <button
              className="signin-submit"
              type="submit"
              disabled={submitting || code.trim().length < 6}
            >
              {submitting ? "Checking…" : "Sign in"}
            </button>
            {error && <div className="signin-error">{error}</div>}
            <button
              type="button"
              className="signin-resend"
              disabled={submitting}
              onClick={(e) => void send(e)}
            >
              Resend code
            </button>
          </form>
        ) : (
          <form className="signin-form" onSubmit={send}>
            <div className="signin-title">Sign in</div>
            <div className="signin-body">We&rsquo;ll email you a sign-in code. No password.</div>
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
              {submitting ? "Sending…" : "Send code"}
            </button>
            {error && <div className="signin-error">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
