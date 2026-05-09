import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { useDictionary } from "./hooks/useDictionary";
import { useChars } from "./hooks/useChars";
import { useSaved } from "./hooks/useSaved";
import { useModalStack, parseHash } from "./hooks/useModalStack";
import { useAuth } from "./hooks/useAuth";
import { wakeUp } from "./lib/supabase";

import { SearchBar, type SearchMode } from "./components/SearchBar";
import { searchByComponent, componentFrequencies } from "./lib/componentSearch";
import { SavedShelf } from "./components/SavedShelf";
import { ResultsList } from "./components/ResultsList";
import { TreeModal } from "./components/TreeModal";
import { CharPopup } from "./components/CharPopup";
import { AuthButton } from "./components/AuthButton";
import { SignInModal } from "./components/SignInModal";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { ReviewPage } from "./components/ReviewPage";
import { ComponentTable } from "./components/ComponentTable";
import { PhoneticsPage } from "./components/PhoneticsPage";
import { ReviewLaunch, type ReviewSettings } from "./components/ReviewLaunch";
import { ClusterRecall } from "./components/ClusterRecall";
import { useReview } from "./hooks/useReview";
import { usePhoneticComponents } from "./hooks/usePhoneticComponents";

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
    review,
    getStatus,
    setStatus,
    importSaved,
    clearAll,
  } = useSaved({ userId: auth.user?.id ?? null });
  const { stack, push, pop } = useModalStack();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("all");
  const [searchResults, setSearchResults] = useState<Word[]>([]);
  const [searching, setSearching] = useState(false);
  const [popupChar, setPopupChar] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showReview, setShowReview] = useState(
    typeof window !== "undefined" && window.location.hash === "#/review",
  );
  const [showPhonetics, setShowPhonetics] = useState(
    typeof window !== "undefined" && window.location.hash === "#/phonetics",
  );

  // Every saved word is queued for review — the user's stated goal is to
  // learn all of them, and the four statuses are about progression
  // (★ → 📕 → 🎓 → ✒), not about what's scheduled.
  const scheduledKeys = saved;

  const phonetics = usePhoneticComponents();
  const phoneticComponentKeys = useMemo(
    () => new Set(phonetics.components.map((c) => c.char)),
    [phonetics.components],
  );

  const reviewState = useReview({
    userId: auth.user?.id ?? null,
    scheduledKeys,
    chars: charsData.chars,
    phoneticComponentKeys,
    phoneticComponentsByChar: phonetics.byChar,
    wroteKeys: wrote,
  });
  const { dueCards, grade, attributeFailure } = reviewState;

  // Wake the Supabase project early to mask cold-start latency.
  useEffect(() => {
    wakeUp();
  }, []);

  // Track full-screen pages via URL hash. Same pattern as the modal stack
  // (in useModalStack); kept inline here because these pages are
  // top-level, not nested.
  useEffect(() => {
    const onHash = () => {
      setShowReview(window.location.hash === "#/review");
      setShowPhonetics(window.location.hash === "#/phonetics");
      // Reset the launched-flag so re-opening Review goes back to the
      // launch screen first.
      if (window.location.hash !== "#/review") {
        setReviewLaunched(null);
        setClusterActive(false);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const closeHashPage = (target: string) => {
    if (window.location.hash === target) history.back();
    else {
      // Synchronously clear the local flag so we don't paint a frame of
      // the page after the user closes it before hashchange fires.
      if (target === "#/review") setShowReview(false);
      if (target === "#/phonetics") setShowPhonetics(false);
    }
  };

  // Launch screen state. null = haven't started yet; ReviewSettings = in
  // a review session with these settings.
  const [reviewLaunched, setReviewLaunched] = useState<ReviewSettings | null>(null);
  // Active cluster-recall session — separate flow from the regular queue.
  const [clusterActive, setClusterActive] = useState(false);

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

  // Run search when the debounced query (or mode) changes.
  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);

    // "By component" mode walks the saved set's component closure locally
    // (no Supabase call) and hydrates only the matching rows.
    if (searchMode === "byComponent") {
      const matches = searchByComponent(
        debouncedQuery,
        savedList.map((s) => s.word),
        charsData.chars,
      );
      (async () => {
        if (matches.length > 0) await dict.ensureCached(matches);
        if (cancelled) return;
        const hydrated = matches
          .map((w) => dict.findWord(w))
          .filter((w): w is Word => !!w);
        setSearchResults(hydrated);
        setSearching(false);
      })();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const rows = await dict.search(debouncedQuery);
      if (cancelled) return;
      setSearchResults(rows);
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchMode, savedList, charsData.chars, dict.search, dict.ensureCached, dict.findWord]);

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


  const top = stack[stack.length - 1];
  const topWord = top?.kind === "word" ? dict.findWord(top.key) : null;

  return (
    <>
      <header className="topbar">
        <HamburgerMenu
          version="chinese v75"
          reviewHref="#/review"
          reviewBadge={dueCards.length}
          phoneticsHref="#/phonetics"
        />
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

      {showReview && !reviewLaunched && !clusterActive && (
        <ReviewLaunch
          totalDue={dueCards.length}
          facetCounts={dueCards.reduce<Record<string, number>>((acc, c) => {
            const f = c.facet === "recognition" ? "meaningRecognition" : c.facet;
            acc[f] = (acc[f] || 0) + 1;
            return acc;
          }, {})}
          canCluster={savedList.length >= 3}
          onStart={(s) => setReviewLaunched(s)}
          onStartCluster={() => setClusterActive(true)}
          onClose={() => closeHashPage("#/review")}
        />
      )}
      {showReview && clusterActive && (
        <ClusterRecall
          savedList={savedList}
          findWord={dict.findWord}
          chars={charsData.chars}
          phoneticComponentsByChar={phonetics.byChar}
          onGrade={(key, rating, kind, facet) => grade(key, rating, kind, facet)}
          onClose={() => setClusterActive(false)}
        />
      )}
      {showReview && reviewLaunched && (
        <ReviewPage
          dueCards={dueCards}
          cards={reviewState.cards}
          findWord={dict.findWord}
          ensureCached={dict.ensureCached}
          chars={charsData.chars}
          phoneticComponents={phonetics.components}
          phoneticComponentsByChar={phonetics.byChar}
          enabledFacets={new Set(reviewLaunched.enabledFacets)}
          randomOrder={reviewLaunched.randomOrder}
          includeSubchars={reviewLaunched.includeSubchars}
          savedKeys={saved}
          onGrade={(key, rating, kind, facet) => grade(key, rating, kind, facet)}
          onAttributeFailure={(childKey) => attributeFailure(childKey)}
          onClose={() => closeHashPage("#/review")}
        />
      )}

      {showPhonetics && (
        <PhoneticsPage
          components={phonetics.components}
          ready={phonetics.ready}
          getStatus={getStatus}
          setStatus={setStatus}
          onClose={() => closeHashPage("#/phonetics")}
        />
      )}

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSignIn={(email) => auth.signInWithEmail(email)}
        />
      )}

      <SearchBar
        value={query}
        onChange={setQuery}
        onEnter={handleEnter}
        mode={searchMode}
        onModeChange={setSearchMode}
      />

      {debouncedQuery.trim() ? (
        searching && searchResults.length === 0 ? (
          <div className="empty-state">Searching…</div>
        ) : (
          <ResultsList
            matches={searchResults}
            saved={saved}
            onOpen={(w) => void openWord(w)}
            getStatus={getStatus}
            setStatus={setStatus}
          />
        )
      ) : searchMode === "byComponent" && saved.size > 0 ? (
        <ComponentTable
          savedWords={savedList.map((s) => s.word)}
          chars={charsData.chars}
          onPick={(c) => setQuery(c)}
        />
      ) : (
        <main className="home" aria-label="Home">
          <SavedShelf
            savedList={savedList}
            learned={learned}
            wrote={wrote}
            review={review}
            findWord={dict.findWord}
            chars={charsData.chars}
            onOpenWord={(w) => void openWord(w)}
            onOpenChar={openCharPopup}
            getStatus={getStatus}
            setStatus={setStatus}
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
          getStatus={getStatus}
          setStatus={setStatus}
          onPop={pop}
          onNodeClick={openCharPopup}
        />
      )}

      {popupChar && (
        <CharPopup
          char={popupChar}
          charData={charsData.chars[popupChar]}
          saved={saved}
          getStatus={getStatus}
          setStatus={setStatus}
          onClose={() => setPopupChar(null)}
          onJumpToWord={(w) => void openWord(w)}
          findWord={dict.findWord}
        />
      )}

      {dict.error && (
        <div className="error-banner">
          Dictionary error: {dict.error}
        </div>
      )}

    </>
  );
}
