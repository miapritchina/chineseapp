import type { PostHog } from "posthog-js";

// Usage measurement (v162, ADR-0019): how the owner actually uses the
// app vs how she thinks she does, before the two-door reorganization.
// Signed-in sessions only, keyed by the Supabase user id — never email.
// The project key is public by design (like the Supabase anon key);
// empty = analytics off. posthog-js is lazy-loaded so it never delays
// first paint.
export const POSTHOG_KEY = "";
export const POSTHOG_HOST = "https://us.i.posthog.com";

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: [string, Record<string, unknown>][] = [];

export function startAnalytics(userId: string) {
  if (!POSTHOG_KEY || loading) return;
  loading = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      autocapture: false,
      session_recording: { maskAllInputs: false },
    });
    posthog.identify(userId);
    client = posthog;
    for (const [event, props] of queue.splice(0)) posthog.capture(event, props);
    return posthog;
  });
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (!POSTHOG_KEY) return;
  if (client) client.capture(event, props);
  else if (queue.length < 200) queue.push([event, props]);
}

export interface SurfaceInput {
  hash: string;
  sentenceMode: boolean;
  gameOpen: string | null;
  reviewGame: string | null;
  reviewLaunched: boolean;
  learn: boolean;
  sift: boolean;
  focus: boolean;
}

// The surface the user is on, at the granularity the reorganization
// cares about: every practice mode and game is its own surface.
export function activeSurface(s: SurfaceInput): string {
  if (s.hash === "#/review") {
    if (s.gameOpen) return `game:${s.gameOpen}`;
    if (s.reviewGame) return `game:${s.reviewGame}`;
    if (s.learn) return "learn";
    if (s.sift) return "sift";
    if (s.focus) return "focus";
    if (s.reviewLaunched) return "review";
    return "review_launch";
  }
  switch (s.hash) {
    case "#/cards":
      return "flashcards";
    case "#/explore":
      return "explore";
    case "#/classic":
      return "classic";
    case "#/stats":
      return "stats";
  }
  return s.sentenceMode ? "sentence" : "home";
}
