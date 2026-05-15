import { createContext, useContext, type Context, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import type { Char, Word } from "../lib/types";
import type { Status, SavedEntry } from "../hooks/useSaved";
import type { MnemonicEntry } from "../lib/mnemonics";

// Three contexts targeting the most-prop-drilled value sets:
//   SavedCtx — the four-tier saved/learned/wrote/review state + setters
//   DictCtx  — word lookup + ensure-cached + search
//   CharsCtx — the static data-chars.json map
// Plus MnemonicsCtx (only EntitySheet needs it) and AuthCtx (top-bar +
// page-level guards). Kept separate so a re-render in one doesn't
// invalidate consumers of the others.
//
// Usage: components call `useSavedCtx()`, `useDictCtx()`, etc. inside
// AppStateProvider's subtree. Throws if used outside.

export interface SavedCtxValue {
  saved: Set<string>;
  savedList: SavedEntry[];
  learned: Set<string>;
  wrote: Set<string>;
  review: Set<string>;
  getStatus: (key: string) => Status | null;
  setStatus: (key: string, next: Status | null) => void;
}

export interface DictCtxValue {
  findWord: (key: string) => Word | null;
  ensureCached: (words: string[]) => Promise<void>;
  search: (query: string) => Promise<Word[]>;
  error: string | null;
}

export interface CharsCtxValue {
  chars: Record<string, Char>;
  ready: boolean;
}

export interface MnemonicsCtxValue {
  get: (key: string) => MnemonicEntry | null;
  save: (key: string, text: string) => void;
  clear: (key: string) => void;
}

export interface AuthCtxValue {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SavedCtx = createContext<SavedCtxValue | null>(null);
const DictCtx = createContext<DictCtxValue | null>(null);
const CharsCtx = createContext<CharsCtxValue | null>(null);
const MnemonicsCtx = createContext<MnemonicsCtxValue | null>(null);
const AuthCtx = createContext<AuthCtxValue | null>(null);

function makeUse<T>(ctx: Context<T | null>, label: string) {
  return function useCtx(): T {
    const v = useContext(ctx);
    if (!v) throw new Error(`${label} used outside <AppStateProvider>`);
    return v;
  };
}

export const useSavedCtx = makeUse(SavedCtx, "useSavedCtx");
export const useDictCtx = makeUse(DictCtx, "useDictCtx");
export const useCharsCtx = makeUse(CharsCtx, "useCharsCtx");
export const useMnemonicsCtx = makeUse(MnemonicsCtx, "useMnemonicsCtx");
export const useAuthCtx = makeUse(AuthCtx, "useAuthCtx");

interface ProviderProps {
  saved: SavedCtxValue;
  dict: DictCtxValue;
  chars: CharsCtxValue;
  mnemonics: MnemonicsCtxValue;
  auth: AuthCtxValue;
  children: ReactNode;
}

export function AppStateProvider({ saved, dict, chars, mnemonics, auth, children }: ProviderProps) {
  return (
    <AuthCtx.Provider value={auth}>
      <CharsCtx.Provider value={chars}>
        <DictCtx.Provider value={dict}>
          <MnemonicsCtx.Provider value={mnemonics}>
            <SavedCtx.Provider value={saved}>{children}</SavedCtx.Provider>
          </MnemonicsCtx.Provider>
        </DictCtx.Provider>
      </CharsCtx.Provider>
    </AuthCtx.Provider>
  );
}
