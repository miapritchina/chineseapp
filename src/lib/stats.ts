// Stats page math (v115, owner request: "statistics/profile page to
// motivate me"). Pure helpers over review-log timestamps and per-word
// FSRS stabilities.

import { siftDayKey } from "./sift";

export interface DayCount {
  day: string;
  count: number;
}

// Per-local-day counts for the last `days` days, oldest first.
export function tallyByDay(timestamps: number[], days: number, now: Date = new Date()): DayCount[] {
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    const k = siftDayKey(new Date(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const k = siftDayKey(d);
    out.push({ day: k, count: counts.get(k) ?? 0 });
  }
  return out;
}

// Consecutive review days ending today (or yesterday, if today has no
// reviews yet — an unfinished day shouldn't read as a broken streak).
export function streakFrom(counts: DayCount[]): number {
  let i = counts.length - 1;
  if (i >= 0 && counts[i].count === 0) i--;
  let streak = 0;
  for (; i >= 0 && counts[i].count > 0; i--) streak++;
  return streak;
}

export interface StrengthBuckets {
  fresh: number; // never reviewed
  shaky: number; // stability < 7 days
  growing: number; // 7–21 days
  solid: number; // ≥ 21 days (mature)
}

export function strengthBuckets(stabilities: number[]): StrengthBuckets {
  const b: StrengthBuckets = { fresh: 0, shaky: 0, growing: 0, solid: 0 };
  for (const s of stabilities) {
    if (!s || s <= 0) b.fresh++;
    else if (s < 7) b.shaky++;
    else if (s < 21) b.growing++;
    else b.solid++;
  }
  return b;
}
