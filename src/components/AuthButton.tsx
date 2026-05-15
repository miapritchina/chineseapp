import type { User } from "@supabase/supabase-js";
import { usePopover } from "../hooks/usePopover";

interface Props {
  user: User | null;
  loading: boolean;
  onSignInClick: () => void;
  onSignOut: () => void;
}

export function AuthButton({ user, loading, onSignInClick, onSignOut }: Props) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();

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
