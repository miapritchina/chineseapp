import { describe, expect, it } from "vitest";
import { applyCascadeCredit, gradeCard, scoreToRating, seedCard } from "./fsrs";

describe("scoreToRating", () => {
  it("maps the rebalance thresholds", () => {
    expect(scoreToRating(1)).toBe("Good");
    expect(scoreToRating(0.9)).toBe("Hard");
    expect(scoreToRating(0.75)).toBe("Hard");
    expect(scoreToRating(0.74)).toBe("Again");
    expect(scoreToRating(0)).toBe("Again");
  });
  it("never returns Easy — auto-graded drills lack recall-strength evidence", () => {
    expect(scoreToRating(2)).toBe("Good");
  });
});

describe("applyCascadeCredit", () => {
  const now = new Date("2026-08-16T12:00:00Z");

  it("keeps a never-reviewed card in the New state with zero reps", () => {
    const prev = seedCard(now);
    const credited = applyCascadeCredit(prev, 7, now);
    expect(credited.state).toBe(prev.state);
    expect(credited.learning_steps).toBe(prev.learning_steps);
    expect(credited.reps).toBe(0);
    expect(credited.lapses).toBe(0);
    expect(credited.stability).toBeGreaterThan(prev.stability);
  });

  it("stamps last_review so the sync tie-break keeps the credited row", () => {
    const prev = seedCard(now);
    const credited = applyCascadeCredit(prev, 7, now);
    expect(credited.last_review).toBe(now.toISOString());
  });

  it("first real grade after credit schedules like a first review", () => {
    const prev = seedCard(now);
    const credited = applyCascadeCredit(prev, 7, now);
    const graded = gradeCard(credited, "Good", new Date(now.getTime() + 86400000));
    expect(graded.reps).toBe(1);
    expect(graded.state).not.toBe(0); // leaves New only on the direct grade
  });

  it("caps the due date at capDays for never-directly-reviewed items", () => {
    // Build real stability first so the uncapped interval would exceed the cap.
    let card = seedCard(now);
    card = gradeCard(card, "Good", now);
    card = gradeCard(card, "Good", new Date(card.due));
    const at = new Date(card.due);
    const credited = applyCascadeCredit(card, 7, at);
    const dueMs = new Date(credited.due).getTime();
    expect(dueMs).toBeLessThanOrEqual(at.getTime() + 7 * 86400000);
  });

  it("preserves reps and lapses on reviewed cards", () => {
    let card = seedCard(now);
    card = gradeCard(card, "Good", now);
    card = gradeCard(card, "Again", new Date(card.due));
    const credited = applyCascadeCredit(card, null, new Date(card.due));
    expect(credited.reps).toBe(card.reps);
    expect(credited.lapses).toBe(card.lapses);
    expect(credited.state).toBe(card.state);
  });
});
