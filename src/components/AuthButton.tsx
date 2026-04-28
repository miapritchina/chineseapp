import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  loading: boolean;
  onSignInClick: () => void;
  onSignOut: () => void;
}

export function AuthButton({ user, loading, onSignInClick, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (loading) {
    return <span className="auth-button auth-loading" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <button className="auth-button" type="button" onClick={onSignInClick}>
        Sign in
      </button>
    );
  }

  const label = user.email ? user.email.split("@")[0] : "Account";

  return (
    <div className="auth-menu" ref={ref}>
      <button
        className="auth-button auth-button-signed"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="auth-dropdown" role="menu">
          <div className="auth-email" title={user.email ?? ""}>
            {user.email}
          </div>
          <button
            className="auth-signout"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
