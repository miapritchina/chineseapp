// Thin wrapper around ts-fsrs. The scheduler is parameter-stable across
// renders; we instantiate it once. Card storage shape is just a plain
// serialized version of ts-fsrs's Card with Date fields → ISO strings.

import {
  fsrs,
  createEmptyCard,
  Rating,
  type Card,
  type Grade,
} from "ts-fsrs";

// FSRS-6, retention 0.9. `enable_short_term: false` disables the intraday
// "learning steps" (the default ["1m","10m"]) — without it, a brand-new
// card graded Good only moves ~10 minutes into the future, so it pops
// back up on the next page open and the schedule feels broken. With
// short-term off, the first Good schedules a real multi-day interval
// straight from initial stability, which is what a "review once a day"
// app wants. (Again still comes back quickly — same-day / next-day.)
const scheduler = fsrs({ enable_short_term: false });

export type RatingName = "Again" | "Hard" | "Good" | "Easy";

const RATING_BY_NAME: Record<RatingName, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

// Serialized form for localStorage / Supabase JSONB. Keep in sync with
// ts-fsrs Card; only Date fields differ.
export interface SerializedCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export function seedCard(now: Date = new Date()): SerializedCard {
  return serialize(createEmptyCard(now));
}

export function serialize(c: Card): SerializedCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : undefined,
  };
}

export function deserialize(s: SerializedCard): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

// Apply a single grade. Returns the new card state.
export function gradeCard(
  card: SerializedCard,
  rating: RatingName,
  now: Date = new Date(),
): SerializedCard {
  const result = scheduler.next(deserialize(card), now, RATING_BY_NAME[rating]);
  return serialize(result.card);
}

// Cascade credit from a parent word's Good/Easy review onto a constituent
// char or component card. Computes what a "Good" grade would do, then:
//   1. Damps the resulting stability halfway back toward the prior stability
//      (so cascade credit is worth ~half of a real review).
//   2. Pulls the due date back proportionally.
//   3. Optionally caps the new due date so a never-directly-reviewed item
//      can't graduate past `capDays`. The plan calls for a 7-day cap on
//      first cascade credit.
//   4. Leaves `reps`, `lapses`, and `last_review` untouched — this is not
//      a direct review and shouldn't pretend to be one.
export function applyCascadeCredit(
  prev: SerializedCard,
  capDays: number | null,
  now: Date = new Date(),
): SerializedCard {
  const result = gradeCard(prev, "Good", now);
  const dampedS = prev.stability + (result.stability - prev.stability) * 0.5;
  const fullDueMs = new Date(result.due).getTime();
  const fullIntervalMs = fullDueMs - now.getTime();
  const dueRatio = result.stability > 0 ? dampedS / result.stability : 0;
  let dueMs = now.getTime() + Math.max(0, fullIntervalMs * dueRatio);
  if (capDays !== null) {
    const capMs = now.getTime() + capDays * 86400000;
    if (dueMs > capMs) dueMs = capMs;
  }
  return {
    ...result,
    stability: dampedS,
    due: new Date(dueMs).toISOString(),
    reps: prev.reps,
    lapses: prev.lapses,
    last_review: prev.last_review,
  };
}

export function isDue(card: SerializedCard, now: Date = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}
