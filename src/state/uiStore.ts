import { create } from "zustand";
import type { ModalEntry } from "../lib/types";

// UI state that App.tsx used to manage with a dozen useState hooks.
// Lives in Zustand so leaf components can read/write without
// prop-drilling and without context-render thrashing.
//
// Cloud-synced state (saved, mnemonics, review) stays in its hooks —
// those own their localStorage + Supabase contract per ADR-0001. The
// store is for UI-only ephemeral state: search input, modal stack,
// page selection, transient flags.
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

  // Modal stack (entity sheet + tree).
  modalStack: ModalEntry[];
  pushModal: (entry: ModalEntry) => void;
  popModal: () => void;
  setModalStack: (stack: ModalEntry[]) => void;

  // Top-level pages routed via URL hash.
  showReview: boolean;
  showPhonetics: boolean;
  setShowReview: (b: boolean) => void;
  setShowPhonetics: (b: boolean) => void;

  // Sign-in modal.
  showSignIn: boolean;
  setShowSignIn: (b: boolean) => void;
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

  modalStack: [],
  pushModal: (entry) => set((s) => ({ modalStack: [...s.modalStack, entry] })),
  popModal: () => set((s) => ({ modalStack: s.modalStack.slice(0, -1) })),
  setModalStack: (stack) => set({ modalStack: stack }),

  showReview: typeof window !== "undefined" && window.location.hash === "#/review",
  showPhonetics: typeof window !== "undefined" && window.location.hash === "#/phonetics",
  setShowReview: (b) => set({ showReview: b }),
  setShowPhonetics: (b) => set({ showPhonetics: b }),

  showSignIn: false,
  setShowSignIn: (b) => set({ showSignIn: b }),
}));
