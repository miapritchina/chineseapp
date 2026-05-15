import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./uiStore";

beforeEach(() => {
  useUIStore.setState({
    query: "",
    debouncedQuery: "",
    searchMode: "all",
    searching: false,
    modalStack: [],
    showReview: false,
    showPhonetics: false,
    showSignIn: false,
  });
});

describe("useUIStore", () => {
  it("updates query", () => {
    useUIStore.getState().setQuery("nǐ");
    expect(useUIStore.getState().query).toBe("nǐ");
  });

  it("push + pop modal stack", () => {
    const s = useUIStore.getState();
    s.pushModal({ kind: "word", key: "你好" });
    s.pushModal({ kind: "char", key: "你" });
    expect(useUIStore.getState().modalStack.map((e) => e.key)).toEqual(["你好", "你"]);
    s.popModal();
    expect(useUIStore.getState().modalStack.map((e) => e.key)).toEqual(["你好"]);
  });

  it("page flags toggle independently", () => {
    useUIStore.getState().setShowReview(true);
    expect(useUIStore.getState().showReview).toBe(true);
    expect(useUIStore.getState().showPhonetics).toBe(false);
    useUIStore.getState().setShowPhonetics(true);
    useUIStore.getState().setShowReview(false);
    expect(useUIStore.getState().showReview).toBe(false);
    expect(useUIStore.getState().showPhonetics).toBe(true);
  });

  it("setModalStack replaces the whole stack", () => {
    useUIStore.getState().setModalStack([
      { kind: "word", key: "a" },
      { kind: "word", key: "b" },
    ]);
    expect(useUIStore.getState().modalStack).toHaveLength(2);
  });
});
