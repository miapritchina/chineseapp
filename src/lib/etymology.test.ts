import { describe, expect, it } from "vitest";
import { cleanEtymologyNotes } from "./etymology";

describe("cleanEtymologyNotes", () => {
  it("strips the boilerplate and keeps the useful sentence (听)", () => {
    expect(
      cleanEtymologyNotes(
        "Phonosemantic compound. 口 represents the meaning and 厅 represents the sound. Simplified form of 聽.  The right side looks like 斤 (axe) but is actually a corruption of 厅.",
      ),
    ).toBe("The right side looks like 斤 (axe) but is actually a corruption of 厅.");
  });
  it("all-boilerplate notes clean to empty (请)", () => {
    expect(
      cleanEtymologyNotes(
        "Simplified form of 請.  Phonosemantic compound. 言 represents the meaning and 青 represents the sound.",
      ),
    ).toBe("");
  });
  it("keeps a longer simplified-form sentence that carries content", () => {
    expect(cleanEtymologyNotes("Simplified form of 聽, which depicts an ear and a heart.")).toBe(
      "Simplified form of 聽, which depicts an ear and a heart.",
    );
  });
  it("passes plain notes through untouched", () => {
    const s = "Depicts a person standing on the ground.";
    expect(cleanEtymologyNotes(s)).toBe(s);
  });
  it("empty/undefined → empty string", () => {
    expect(cleanEtymologyNotes("")).toBe("");
    expect(cleanEtymologyNotes(undefined)).toBe("");
  });
});
