import { describe, expect, it } from "vitest";
import { PULL_ARM_PX, PULL_SHOW_PX, pullPhase } from "./pullRefresh";

describe("pullPhase", () => {
  it("ignores a small overscroll", () => {
    expect(pullPhase(0)).toBe("idle");
    expect(pullPhase(PULL_SHOW_PX - 1)).toBe("idle");
  });

  it("shows the hint once the pull is deliberate", () => {
    expect(pullPhase(PULL_SHOW_PX)).toBe("pulling");
    expect(pullPhase(PULL_ARM_PX - 1)).toBe("pulling");
  });

  it("arms only on a long pull", () => {
    expect(pullPhase(PULL_ARM_PX)).toBe("armed");
    expect(pullPhase(PULL_ARM_PX * 3)).toBe("armed");
  });
});
