import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./uiStore";

beforeEach(() => {
  useUIStore.setState({
    query: "",
    debouncedQuery: "",
    searchMode: "all",
    searching: false,
    showReview: false,
    showExplore: false,
    showSignIn: false,
  });
});

describe("useUIStore", () => {
  it("updates query", () => {
    useUIStore.getState().setQuery("nǐ");
    expect(useUIStore.getState().query).toBe("nǐ");
  });

  it("page flags toggle independently", () => {
    useUIStore.getState().setShowReview(true);
    expect(useUIStore.getState().showReview).toBe(true);
    expect(useUIStore.getState().showExplore).toBe(false);
    useUIStore.getState().setShowExplore(true);
    useUIStore.getState().setShowReview(false);
    expect(useUIStore.getState().showReview).toBe(false);
    expect(useUIStore.getState().showExplore).toBe(true);
  });
});
