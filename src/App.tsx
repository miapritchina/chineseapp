import { useEffect, useRef, useState } from "react";
import "./styles.css";

import { useDictionary } from "./hooks/useDictionary";
import { useChars } from "./hooks/useChars";
import { useSaved } from "./hooks/useSaved";
import { useModalStack, parseHash } from "./hooks/useModalStack";
import { useAuth } from "./hooks/useAuth";
import { wakeUp } from "./lib/supabase";

import { SearchBar } from "./components/SearchBar";
import { SavedShelf } from "./components/SavedShelf";
import { ResultsList } from "./components/ResultsList";
import { TreeModal } from "./components/TreeModal";
import { CharPopup } from "./components/CharPopup";
import { AuthButton } from "./components/AuthButton";
import { SignInModal } from "./components/SignInModal";

import type { Word } from "./lib/types";

const SEARCH_DEBOUNCE_MS = 200;

export function App() {
  const dict = useDictionary();
  const charsData = useChars();
  const auth = useAuth();
  const {
    saved,
    savedList,
    learned,
    wrote,
    toggle,
    toggleLearned,
    toggleWrote,
    exportSaved,
    importSaved,
    clearAll,
  } = useSaved({ userId: auth.user?.id ?? null });
  const { stack, push, pop } = useModalStack();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Word[]>([]);
  const [searching, setSearching] = useState(false);
  const [popupChar, setPopupChar] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  // Wake the Supabase project early to mask cold-start latency.
  useEffect(() => {
    wakeUp();
  }, []);

  // Close the sign-in modal as soon as a session lands (auth flows from
  // a different tab still propagate via onAuthStateChange).
  useEffect(() => {
    if (auth.user) setShowSignIn(false);
  }, [auth.user]);

  // Debounce search input.
  const searchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query]);

  // Run search when the debounced query changes.
  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    (async () => {
      const rows = await dict.search(debouncedQuery);
      if (cancelled) return;
      setSearchResults(rows);
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, dict.search]);

  // Pre-hydrate saved words so the Saved shelf renders without per-card flicker.
  useEffect(() => {
    if (saved.size === 0) return;
    void dict.ensureCached([...saved]);
  }, [saved, dict.ensureCached]);

  // Deep-link via hash on first load.
  const deepLinkRunRef = useRef(false);
  useEffect(() => {
    if (deepLinkRunRef.current) return;
    deepLinkRunRef.current = true;
    const initial = parseHash();
    if (!initial) return;
    if (initial.kind === "word") {
      void dict.ensureCached([initial.key]).then(() => push(initial));
    } else if (initial.kind === "char") {
      push(initial);
    }
  }, [dict.ensureCached, push]);

  // Auto-import via ?import=<url> on first load. Same-origin only; the user
  // confirms before anything writes. Useful for one-tap "save these N words"
  // links instead of a file-picker dance on mobile.
  //
  // Waits for auth to resolve before firing — otherwise importSaved would run
  // with userId=null and only touch localStorage, even for signed-in users
  // (the upload then happens later via the useSaved sync effect, which is
  // confusing if the user is staring at the alert).
  const autoImportRanRef = useRef(false);
  useEffect(() => {
    if (autoImportRanRef.current) return;
    if (auth.loading) return;
    autoImportRanRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const importUrl = params.get("import");
    if (!importUrl) return;

    (async () => {
      try {
        const target = new URL(importUrl, window.location.href);
        if (target.origin !== window.location.origin) {
          alert("Import URL must be same-origin.");
          return;
        }
        const resp = await fetch(target.toString());
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json: unknown = await resp.json();
        let items: string[] | null = null;
        if (Array.isArray(json)) {
          items = json.filter((x): x is string => typeof x === "string");
        } else if (
          json &&
          typeof json === "object" &&
          Array.isArray((json as { saved?: unknown }).saved)
        ) {
          items = (json as { saved: unknown[] }).saved.filter(
            (x): x is string => typeof x === "string",
          );
        }
        if (!items || items.length === 0) {
          alert("Import URL did not return a valid saved-words file.");
          return;
        }
        const ok = window.confirm(
          `Import ${items.length} word${items.length === 1 ? "" : "s"} into your saved list?`,
        );
        if (!ok) return;
        const { added, total } = await importSaved(items);
        const skipped = total - added;
        const skippedNote = skipped > 0 ? ` (${skipped} already saved)` : "";
        alert(`Imported ${added} word${added === 1 ? "" : "s"}${skippedNote}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Import failed: ${message}`);
      } finally {
        // Clear the import param from the URL so a refresh doesn't re-import.
        const url = new URL(window.location.href);
        url.searchParams.delete("import");
        window.history.replaceState({}, "", url.toString());
      }
    })();
  }, [auth.loading, importSaved]);

  // Auto-clear via ?clear=1. Symmetric to ?import=. Always confirms first;
  // wipes localStorage + (if signed in) every user_saves row for the user.
  // Same auth-loading gate as ?import= — without it the DB rows survive and
  // re-sync on the next render, making clear look like it didn't take.
  const autoClearRanRef = useRef(false);
  useEffect(() => {
    if (autoClearRanRef.current) return;
    if (auth.loading) return;
    autoClearRanRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("clear") !== "1") return;

    (async () => {
      const ok = window.confirm(
        "Clear ALL your saved words? This removes them from this device and (if you're signed in) from your account on every device. This cannot be undone.",
      );
      if (ok) {
        const { cleared } = await clearAll();
        alert(`Cleared ${cleared} saved word${cleared === 1 ? "" : "s"}.`);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("clear");
      window.history.replaceState({}, "", url.toString());
    })();
  }, [auth.loading, clearAll]);

  const handleEnter = () => {
    if (searchResults.length > 0) {
      void openWord(searchResults[0].word);
    }
  };

  const openWord = async (word: string) => {
    await dict.ensureCached([word]);
    push({ kind: "word", key: word });
  };

  const openCharPopup = (char: string) => setPopupChar(char);

  const openCharAsTree = (char: string) => push({ kind: "char", key: char });

  const top = stack[stack.length - 1];
  const topWord = top?.kind === "word" ? dict.findWord(top.key) : null;

  return (
    <>
      <header className="topbar">
        <span className="home-link" />
        <h1>中文</h1>
        <div className="topbar-end">
          <AuthButton
            user={auth.user}
            loading={auth.loading}
            onSignInClick={() => setShowSignIn(true)}
            onSignOut={() => void auth.signOut()}
          />
        </div>
      </header>

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSignIn={(email) => auth.signInWithEmail(email)}
        />
      )}

      <SearchBar value={query} onChange={setQuery} onEnter={handleEnter} />

      {debouncedQuery.trim() ? (
        searching && searchResults.length === 0 ? (
          <div className="empty-state">Searching…</div>
        ) : (
          <ResultsList
            matches={searchResults}
            saved={saved}
            onOpen={(w) => void openWord(w)}
          />
        )
      ) : (
        <main className="home" aria-label="Home">
          <SavedShelf
            savedList={savedList}
            learned={learned}
            wrote={wrote}
            findWord={dict.findWord}
            chars={charsData.chars}
            onOpenWord={(w) => void openWord(w)}
            onOpenChar={openCharPopup}
            onExport={exportSaved}
            onImport={importSaved}
          />
        </main>
      )}

      {top && (
        <TreeModal
          entry={top}
          word={topWord}
          chars={charsData.chars}
          stackLen={stack.length}
          saved={saved}
          learned={learned}
          wrote={wrote}
          onToggleSave={toggle}
          onToggleLearned={toggleLearned}
          onToggleWrote={toggleWrote}
          onPop={pop}
          onNodeClick={openCharPopup}
        />
      )}

      {popupChar && (
        <CharPopup
          char={popupChar}
          charData={charsData.chars[popupChar]}
          saved={saved}
          onToggleSave={toggle}
          onClose={() => setPopupChar(null)}
          onJumpToWord={(w) => void openWord(w)}
          onOpenAsTree={openCharAsTree}
          findWord={dict.findWord}
        />
      )}

      {dict.error && (
        <div className="error-banner">
          Dictionary error: {dict.error}
        </div>
      )}

      <div className="page-id">chinese v47</div>
    </>
  );
}
