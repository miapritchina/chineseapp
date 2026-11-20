import { useEffect, useRef, useState } from "react";
import { pullPhase, refreshApp, type PullPhase } from "../lib/pullRefresh";
import { track } from "../lib/analytics";

interface Props {
  // Only the home screen scrolls the document; full-screen pages and
  // sheets have their own scroll and must not trigger a reload.
  enabled: boolean;
}

export function PullToRefresh({ enabled }: Props) {
  const [phase, setPhase] = useState<PullPhase | "refreshing">("idle");
  const startYRef = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!enabled) {
      startYRef.current = null;
      if (phaseRef.current !== "refreshing") setPhase("idle");
      return;
    }
    const onStart = (e: TouchEvent) => {
      startYRef.current =
        e.touches.length === 1 && window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startYRef.current === null || phaseRef.current === "refreshing") return;
      // iOS reports a negative scrollY while it rubber-bands, so "at the
      // top" is <= 0; a positive value means the page scrolled instead.
      if (window.scrollY > 0) {
        startYRef.current = null;
        setPhase("idle");
        return;
      }
      setPhase(pullPhase(e.touches[0].clientY - startYRef.current));
    };
    const onEnd = () => {
      if (startYRef.current === null || phaseRef.current === "refreshing") return;
      startYRef.current = null;
      if (phaseRef.current === "armed") {
        setPhase("refreshing");
        track("pull_refresh");
        void refreshApp();
      } else {
        setPhase("idle");
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);

  if (phase === "idle") return null;
  return (
    <div className={`pull-refresh is-${phase}`} role="status" aria-live="polite">
      {phase === "pulling" && "↓ Keep pulling to update"}
      {phase === "armed" && "↑ Release to update"}
      {phase === "refreshing" && "Checking for a new version…"}
    </div>
  );
}
