import { useEffect, useRef, useState } from "react";

// Shared "anchored panel that dismisses on outside-click + Escape" wiring.
// Used by StatusButton, HamburgerMenu, AuthButton — each used to ship its
// own copy of these listeners. Put the returned `ref` on the wrapper element
// that contains both the trigger and the panel; clicks/taps inside it don't
// dismiss.
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (target && ref.current && !ref.current.contains(target)) setOpen(false);
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

  return { open, setOpen, ref };
}
