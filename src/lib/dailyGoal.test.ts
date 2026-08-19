import { beforeEach, describe, expect, it } from "vitest";
import { bumpDailyDone, loadDailyDone } from "./dailyGoal";

describe("dailyGoal", () => {
  beforeEach(() => localStorage.clear());
  it("starts at 0 and accumulates within the day", () => {
    expect(loadDailyDone()).toBe(0);
    expect(bumpDailyDone()).toBe(1);
    expect(bumpDailyDone()).toBe(2);
    expect(loadDailyDone()).toBe(2);
  });
  it("resets on a new day", () => {
    bumpDailyDone(5, new Date("2026-08-17T10:00:00"));
    expect(loadDailyDone(new Date("2026-08-17T23:00:00"))).toBe(5);
    expect(loadDailyDone(new Date("2026-08-18T01:00:00"))).toBe(0);
  });
});
