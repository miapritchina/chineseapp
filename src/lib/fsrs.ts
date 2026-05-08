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

const scheduler = fsrs(); // default parameters; FSRS-6, retention 0.9

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

export function isDue(card: SerializedCard, now: Date = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}
