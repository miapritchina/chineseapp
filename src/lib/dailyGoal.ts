// Daily review expectation (v137, owner: a 1000+ backlog "stresses me
// out"). The backlog stays fully available (ADR-0012 stands) — this
// only changes the EXPECTATION: the badge counts down a modest daily
// goal instead of shouting the whole backlog, and doing more is
// always allowed. Per-day ephemeral → localStorage-only (same
// carve-out as siftKept).

import { siftDayKey } from "./sift";

export const DAILY_GOAL = 30;
const KEY = "chinese.dailyDone";

export function loadDailyDone(now = new Date()): number {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && raw.day === siftDayKey(now) && typeof raw.count === "number") {
      return raw.count;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function bumpDailyDone(n = 1, now = new Date()): number {
  const next = loadDailyDone(now) + n;
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: siftDayKey(now), count: next }));
  } catch {
    /* ignore */
  }
  return next;
}
