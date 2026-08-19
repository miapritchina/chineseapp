// Thin wrapper around ts-fsrs. The scheduler is parameter-stable across
// renders; we instantiate it once. Card storage shape is just a plain
// serialized version of ts-fsrs's Card with Date fields → ISO strings.

import { fsrs, createEmptyCard, Rating, type Card, type Grade } from "ts-fsrs";

// FSRS-6, retention 0.9. `enable_short_term: false` disables the intraday
// "learning steps" (the default ["1m","10m"]) — without it, a brand-new
// card graded Good only moves ~10 minutes into the future, so it pops
// back up on the next page open and the schedule feels broken. With
// short-term off, the first Good schedules a real multi-day interval
// straight from initial stability, which is what a "review once a day"
// app wants. (Again still comes back quickly — same-day / next-day.)
const scheduler = fsrs({ enable_short_term: false });

export type RatingName = "Again" | "Hard" | "Good" | "Easy";

// Auto-graded drills compute a 0–1 performance score; this is the one
// boundary where it becomes an FSRS rating. Never Easy — hint-rich
// drill formats don't provide recall-strength evidence.
export function scoreToRating(score: number): RatingName {
  if (score >= 1) return "Good";
  if (score >= 0.75) return "Hard";
  return "Again";
}

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
//   4. Leaves `reps` and `lapses` untouched — this is not a direct
//      review and shouldn't pretend to be one. `state`/`learning_steps`
//      are preserved too, so a never-reviewed card stays New and its
//      first real grade schedules as a first review. `last_review` IS
//      stamped: the sync merge breaks equal-reps ties by recency, so
//      an unstamped credit would lose to the stale remote row.
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
    state: prev.state,
    learning_steps: prev.learning_steps,
    reps: prev.reps,
    lapses: prev.lapses,
    last_review: now.toISOString(),
  };
}

// Known-parts head start (v136): the minimum constituent-character
// stability of a multi-char word, or null when any character has no
// review history (no prior — the word starts due-now like before).
// Callers give a brand-new word a damped cascade-style credit when
// every part is already strong: words built from well-known characters
// need less attention than words hiding a problem character.
export function knownPartsStability(
  word: string,
  stabilityOf: (char: string) => number | null,
): number | null {
  const glyphs = [...new Set(word)];
  if (glyphs.length < 2) return null;
  let min = Infinity;
  for (const c of glyphs) {
    const s = stabilityOf(c);
    if (s === null) return null;
    min = Math.min(min, s);
  }
  return min;
}

// Schedule-only snooze: floor the due date at `until` without touching
// stability, reps, or state. Used after a Sift lesson (v126) — a word
// the user just studied shouldn't be re-tested minutes later.
export function snoozeCard(card: SerializedCard, until: Date): SerializedCard {
  if (new Date(card.due).getTime() >= until.getTime()) return card;
  return { ...card, due: until.toISOString() };
}

export function isDue(card: SerializedCard, now: Date = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}
