import { describe, expect, it } from "vitest";
import { render, renderHook } from "@testing-library/react";
import { AppStateProvider, useSavedCtx, useDictCtx, useCharsCtx } from "./contexts";

const stubProviderProps = {
  saved: {
    saved: new Set<string>(["你好"]),
    savedList: [{ word: "你好", savedAt: 1 }],
    learned: new Set<string>(),
    wrote: new Set<string>(),
    review: new Set<string>(),
    getStatus: () => "saved" as const,
    setStatus: () => {},
  },
  dict: {
    findWord: (k: string) => (k === "你好" ? ({ word: "你好" } as never) : undefined),
    ensureCached: async () => {},
    search: async () => [],
    error: null,
  },
  chars: { chars: {}, ready: true },
  mnemonics: { get: () => null, save: () => {}, clear: () => {} },
  auth: {
    user: null,
    loading: false,
    signInWithEmail: async () => ({}),
    signOut: async () => {},
  },
};

describe("AppStateProvider", () => {
  it("provides saved context to descendants", () => {
    const { result } = renderHook(() => useSavedCtx(), {
      wrapper: ({ children }) => (
        <AppStateProvider {...stubProviderProps}>{children}</AppStateProvider>
      ),
    });
    expect(result.current.saved.has("你好")).toBe(true);
  });

  it("provides dict context", () => {
    const { result } = renderHook(() => useDictCtx(), {
      wrapper: ({ children }) => (
        <AppStateProvider {...stubProviderProps}>{children}</AppStateProvider>
      ),
    });
    expect(result.current.findWord("你好")).toBeTruthy();
    expect(result.current.findWord("missing")).toBeUndefined();
  });

  it("provides chars context", () => {
    const { result } = renderHook(() => useCharsCtx(), {
      wrapper: ({ children }) => (
        <AppStateProvider {...stubProviderProps}>{children}</AppStateProvider>
      ),
    });
    expect(result.current.ready).toBe(true);
  });

  it("throws when consumed outside the provider", () => {
    function Boom() {
      useSavedCtx();
      return null;
    }
    expect(() => render(<Boom />)).toThrow(/useSavedCtx used outside/);
  });
});
