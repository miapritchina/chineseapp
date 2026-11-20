import type { PostHog } from "posthog-js";

// Usage measurement (v162, ADR-0019; full free feature set since v163,
// ADR-0020): how the owner actually uses the app vs how she thinks she
// does, before the two-door reorganization. Owner's PERSONAL PostHog
// project (US cloud) — not the work account. Signed-in sessions only,
// keyed by the Supabase user id — never email. The project key is
// public by design (like the Supabase anon key). posthog-js is
// lazy-loaded so it never delays first paint.
export const POSTHOG_KEY = "phc_Bym9u4MV2tLb6YmGStksWtW9Z2yCAYGeeUqKz86CJxxh";
export const POSTHOG_HOST = "https://us.i.posthog.com";

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: [string, Record<string, unknown>][] = [];

let currentSurface = "home";

export function startAnalytics(userId: string, superProps: Record<string, unknown>) {
  if (!POSTHOG_KEY || loading) return;
  loading = import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      // Hash routes (#/review, #/w/…) are the app's pages.
      capture_pageview: { path: true, search: true, hash: true },
      capture_pageleave: true,
      autocapture: true,
      rageclick: true,
      capture_dead_clicks: true,
      enable_heatmaps: true,
      capture_exceptions: true,
      capture_performance: { web_vitals: true, network_timing: true },
      enable_recording_console_log: true,
      // No network headers/bodies: they would carry the Supabase token.
      session_recording: { maskAllInputs: false },
      disable_surveys: false,
    });
    posthog.register({ ...superProps, surface: currentSurface });
    posthog.identify(userId);
    client = posthog;
    for (const [event, props] of queue.splice(0)) posthog.capture(event, props);
    return posthog;
  });
}

// Every later event (autocaptured clicks included) carries the surface,
// so heatmaps and click data split by mode even inside #/review.
export function setSurface(surface: string) {
  currentSurface = surface;
  client?.register({ surface });
}

export function reportError(err: unknown) {
  if (client && err instanceof Error) client.captureException(err);
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (!POSTHOG_KEY) return;
  if (client) client.capture(event, props);
  else if (queue.length < 200) queue.push([event, props]);
}

// An `error` event that names no error: a bare Event (no error, no
// message) or a third-party script's masked "Script error.". Neither is
// an uncaught exception in our own code, so the on-page error overlay
// must not blank the app for it (BUG-20).
export function isOpaqueErrorEvent(e: { error?: unknown; message?: string }): boolean {
  return e.error == null && (!e.message || e.message === "Script error.");
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
