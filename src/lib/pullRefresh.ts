// Pull-to-refresh (v167, owner request): the installed PWA has no
// browser chrome, so there was no way to reload and pick up a new
// build. A LONG pull on the home screen does it — long on purpose, so
// an ordinary overscroll never reloads the app by accident.
export const PULL_SHOW_PX = 40;
export const PULL_ARM_PX = 150;

export type PullPhase = "idle" | "pulling" | "armed";

// `distance` is how far the finger has travelled down from where the
// touch began, with the page already at its top.
export function pullPhase(distance: number): PullPhase {
  if (distance >= PULL_ARM_PX) return "armed";
  if (distance >= PULL_SHOW_PX) return "pulling";
  return "idle";
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Ask the service worker for a new build, let it activate (skipWaiting +
// clientsClaim), then reload onto it. The timeouts keep a flaky network
// from leaving the app stuck on "checking" — it reloads regardless.
export async function refreshApp(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await Promise.race([reg.update(), wait(4000)]);
      const sw = reg.installing ?? reg.waiting;
      if (sw) {
        await Promise.race([
          new Promise<void>((resolve) => {
            sw.addEventListener("statechange", () => {
              if (sw.state === "activated") resolve();
            });
          }),
          wait(8000),
        ]);
      }
    }
  } catch {
    /* offline or no service worker — a plain reload is still right */
  }
  window.location.reload();
}
