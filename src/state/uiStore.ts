import { create } from "zustand";

// UI state that App.tsx used to manage with a dozen useState hooks.
// Lives in Zustand so leaf components can read/write without
// prop-drilling and without context-render thrashing.
//
// Cloud-synced state (saved, mnemonics, review) stays in its hooks —
// those own their localStorage + Supabase contract per ADR-0001. The
// modal stack stays in useModalStack — it owns history.pushState
// integration. This store is for UI-only ephemeral flags.
//
// Selector usage: components subscribe via `useUIStore((s) => s.field)`
// to avoid re-rendering on unrelated field changes.

export type SearchMode = "all" | "byComponent" | "sentence";

export interface UIState {
  // Search
  query: string;
  debouncedQuery: string;
  searchMode: SearchMode;
  searching: boolean;
  setQuery: (q: string) => void;
  setDebouncedQuery: (q: string) => void;
  setSearchMode: (m: SearchMode) => void;
  setSearching: (b: boolean) => void;

  // Top-level pages routed via URL hash.
  showReview: boolean;
  showExplore: boolean;
  showClassic: boolean;
  setShowReview: (b: boolean) => void;
  setShowExplore: (b: boolean) => void;
  setShowClassic: (b: boolean) => void;

  // Sign-in modal.
  showSignIn: boolean;
  setShowSignIn: (b: boolean) => void;

  // Bug report modal. Opened from the always-present in-bar bug icon on
  // every surface, so it lives in the store rather than being prop-drilled.
  showBugReport: boolean;
  setShowBugReport: (b: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  query: "",
  debouncedQuery: "",
  searchMode: "all",
  searching: false,
  setQuery: (q) => set({ query: q }),
  setDebouncedQuery: (q) => set({ debouncedQuery: q }),
  setSearchMode: (m) => set({ searchMode: m }),
  setSearching: (b) => set({ searching: b }),

  showReview: typeof window !== "undefined" && window.location.hash === "#/review",
  showExplore: typeof window !== "undefined" && window.location.hash === "#/explore",
  showClassic: typeof window !== "undefined" && window.location.hash === "#/classic",
  setShowReview: (b) => set({ showReview: b }),
  setShowExplore: (b) => set({ showExplore: b }),
  setShowClassic: (b) => set({ showClassic: b }),

  showSignIn: false,
  setShowSignIn: (b) => set({ showSignIn: b }),

  showBugReport: false,
  setShowBugReport: (b) => set({ showBugReport: b }),
}));
