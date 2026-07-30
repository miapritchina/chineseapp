import { describe, expect, it } from "vitest";
import { planFlow, SIFT_FLOW_MIN } from "./flow";

describe("planFlow", () => {
  it("sift leads only when the backlog is big enough", () => {
    expect(planFlow(SIFT_FLOW_MIN, 5)).toEqual(["sift", "review", "learn"]);
    expect(planFlow(SIFT_FLOW_MIN - 1, 5)).toEqual(["review", "learn"]);
  });
  it("learn stage only when there is something to learn", () => {
    expect(planFlow(0, 0)).toEqual(["review"]);
    expect(planFlow(100, 0)).toEqual(["sift", "review"]);
  });
});
