import { describe, expect, it } from "vitest";
import { activeSurface, type SurfaceInput } from "./analytics";

const base: SurfaceInput = {
  hash: "",
  sentenceMode: false,
  gameOpen: null,
  reviewGame: null,
  reviewLaunched: false,
  learn: false,
  sift: false,
  focus: false,
};

describe("activeSurface", () => {
  it("home by default, sentence studio when in sentence mode", () => {
    expect(activeSurface(base)).toBe("home");
    expect(activeSurface({ ...base, sentenceMode: true })).toBe("sentence");
  });

  it("names every full-screen page", () => {
    expect(activeSurface({ ...base, hash: "#/cards" })).toBe("flashcards");
    expect(activeSurface({ ...base, hash: "#/explore" })).toBe("explore");
    expect(activeSurface({ ...base, hash: "#/classic" })).toBe("classic");
    expect(activeSurface({ ...base, hash: "#/stats" })).toBe("stats");
  });

  it("splits #/review into launch screen, modes and games", () => {
    const r = { ...base, hash: "#/review" };
    expect(activeSurface(r)).toBe("review_launch");
    expect(activeSurface({ ...r, reviewLaunched: true })).toBe("review");
    expect(activeSurface({ ...r, learn: true })).toBe("learn");
    expect(activeSurface({ ...r, sift: true })).toBe("sift");
    expect(activeSurface({ ...r, focus: true })).toBe("focus");
    expect(activeSurface({ ...r, gameOpen: "chain" })).toBe("game:chain");
  });

  it("a game run inside a review session counts as the game", () => {
    expect(
      activeSurface({ ...base, hash: "#/review", reviewLaunched: true, reviewGame: "newWords" }),
    ).toBe("game:newWords");
  });
});
