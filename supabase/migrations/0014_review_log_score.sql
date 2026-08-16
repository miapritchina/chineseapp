-- Raw 0–1 performance score for auto-graded drills (exercise-system
-- rebalance stage 3). The rating column stays the scheduler's input;
-- score preserves the continuous signal (stroke accuracy, sweep hit
-- rate) for future parameter tuning. Null for self-graded rows.
--
-- Idempotent + additive, per ADR-0005.

ALTER TABLE user_review_log ADD COLUMN IF NOT EXISTS score NUMERIC;
