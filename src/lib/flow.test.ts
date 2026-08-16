import { describe, expect, it } from "vitest";
import { planFlow } from "./flow";

describe("planFlow", () => {
  it("always leads with review — sift is standalone triage, not a stage (v123)", () => {
    expect(planFlow(5)).toEqual(["review", "learn"]);
  });
  it("learn stage only when there is something to learn", () => {
    expect(planFlow(0)).toEqual(["review"]);
  });
});
