import { describe, expect, it } from "vitest";
import { tallyByDay, streakFrom, strengthBuckets } from "./stats";

const now = new Date(2026, 6, 30, 12, 0); // local July 30
const day = (offset: number, hour = 10) => new Date(2026, 6, 30 - offset, hour).getTime();

describe("tallyByDay", () => {
  it("buckets timestamps into local days, oldest first", () => {
    const t = tallyByDay([day(0), day(0), day(2)], 3, now);
    expect(t.map((d) => d.count)).toEqual([1, 0, 2]);
    expect(t[2].day).toBe("2026-07-30");
  });
});

describe("streakFrom", () => {
  it("counts consecutive days ending today", () => {
    expect(streakFrom(tallyByDay([day(0), day(1), day(2)], 5, now))).toBe(3);
  });
  it("an empty today does not break the streak", () => {
    expect(streakFrom(tallyByDay([day(1), day(2)], 5, now))).toBe(2);
  });
  it("gap resets", () => {
    expect(streakFrom(tallyByDay([day(0), day(2)], 5, now))).toBe(1);
  });
});

describe("strengthBuckets", () => {
  it("splits by stability", () => {
    expect(strengthBuckets([0, 0.5, 3, 8, 20, 25, 100])).toEqual({
      fresh: 1,
      shaky: 2,
      growing: 2,
      solid: 2,
    });
  });
});
