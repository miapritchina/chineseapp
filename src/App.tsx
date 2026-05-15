import { useEffect, useMemo, useRef } from "react";
import "./styles.css";

import { useDictionary } from "./hooks/useDictionary";
import { useChars } from "./hooks/useChars";
import { useSaved } from "./hooks/useSaved";
import { useModalStack, parseHash } from "./hooks/useModalStack";
import { useAuth } from "./hooks/useAuth";
import { useReview } from "./hooks/useReview";
import { usePhoneticComponents } from "./hooks/usePhoneticComponents";
import { useMnemonics } from "./hooks/useMnemonics";
import { supabase, wakeUp } from "./lib/supabase";

import { SearchBar } from "./components/SearchBar";
import { searchByComponent } from "./lib/componentSearch";
import { SavedShelf } from "./components/SavedShelf";
import { ResultsList } from "./components/ResultsList";
import { TreeModal } from "./components/TreeModal";
import { EntitySheet } from "./components/EntitySheet";
import { AuthButton } from "./components/AuthButton";
import { SignInModal } from "./components/SignInModal";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { ReviewPage } from "./components/ReviewPage";
import { ComponentTable } from "./components/ComponentTable";
import { PhoneticsPage } from "./components/PhoneticsPage";
import { ReviewLaunch, type ReviewSettings } from "./components/ReviewLaunch";
import { ClusterRecall } from "./components/ClusterRecall";
import { SentenceStudio } from "./components/SentenceStudio";

import { AppStateProvider } from "./state/contexts";
import { useUIStore } from "./state/uiStore";
import {
  decodeWords,
  encodeWords,
  looksLikeShareToken,
  makeShareToken,
  shareUrl,
} from "./lib/share";

import type { Word, ModalEntry } from "./lib/types";
import { useState } from "react";

const SEARCH_DEBOUNCE_MS = 200;

export function App() {
  const dict = useDictionary();
  const charsData = useChars();
  const auth = useAuth();
  const saved = useSaved({ userId: auth.user?.id ?? null });
  const { stack, push, pop } = useModalStack();

  const query = useUIStore((s) => s.query);
  const setQuery = useUIStore((s) => s.setQuery);
  const debouncedQuery = useUIStore((s) => s.debouncedQuery);
  const setDebouncedQuery = useUIStore((s) => s.setDebouncedQuery);
  const searchMode = useUIStore((s) => s.searchMode);
  const setSearchMode = useUIStore((s) => s.setSearchMode);
  const searching = useUIStore((s) => s.searching);
  const setSearching = useUIStore((s) => s.setSearching);
  const showReview = useUIStore((s) => s.showReview);
  const setShowReview = useUIStore((s) => s.setShowReview);
  const showPhonetics = useUIStore((s) => s.showPhonetics);
  const setShowPhonetics = useUIStore((s) => s.setShowPhonetics);
  const showSignIn = useUIStore((s) => s.showSignIn);
  const setShowSignIn = useUIStore((s) => s.setShowSignIn);

  const [searchResults, setSearchResults] = useState<Word[]>([]);

  // Every saved word is queued for review — the user's stated goal is to
  // learn all of them, and the four statuses are about progression
  // (★ → 📕 → 🎓 → ✒), not about what's scheduled.
  const scheduledKeys = saved.saved;

  const phonetics = usePhoneticComponents();
  const mnemonics = useMnemonics({ userId: auth.user?.id ?? null });
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
    wroteKeys: saved.wrote,
  });
  const { dueCards, grade, attributeFailure } = reviewState;

  // Wake the Supabase project early to mask cold-start latency.
  useEffect(() => {
    wakeUp();
  }, []);

  // --- Deep links: #/c/:char and #/w/:word open the EntitySheet. ---
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const deepLinkDepsRef = useRef({ ensureCached: dict.ensureCached, push });
  deepLinkDepsRef.current = { ensureCached: dict.ensureCached, push };
  const openFromHash = useRef((entry: ModalEntry) => {
    history.replaceState(history.state, "", location.pathname + location.search);
    const { ensureCached, push: pushEntry } = deepLinkDepsRef.current;
    if (entry.kind === "word") void ensureCached([entry.key]).then(() => pushEntry(entry));
    else pushEntry(entry);
  }).current;

  // Launch screen state. null = haven't started yet.
  const [reviewLaunched, setReviewLaunched] = useState<ReviewSettings | null>(null);
  const [clusterActive, setClusterActive] = useState(false);

  // Track full-screen pages via URL hash + route #/c, #/w deep links.
  useEffect(() => {
    const onHash = () => {
      setShowReview(window.location.hash === "#/review");
      setShowPhonetics(window.location.hash === "#/phonetics");
      if (window.location.hash === "#/sentence") {
        setSearchMode("sentence");
        history.replaceState(history.state, "", location.pathname + location.search);
      }
      if (window.location.hash !== "#/review") {
        setReviewLaunched(null);
        setClusterActive(false);
      }
      const entry = parseHash();
      if (entry) {
        const inStack = stackRef.current.some(
          (e) => e.kind === entry.kind && e.key === entry.key && e.view !== "tree",
        );
        if (!inStack) openFromHash(entry);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [openFromHash, setShowReview, setShowPhonetics, setSearchMode]);

  const closeHashPage = (target: string) => {
    if (window.location.hash === target) history.back();
    else {
      if (target === "#/review") setShowReview(false);
      if (target === "#/phonetics") setShowPhonetics(false);
    }
  };

  // Close sign-in once a session lands.
  useEffect(() => {
    if (auth.user) setShowSignIn(false);
  }, [auth.user, setShowSignIn]);

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
  }, [query, setDebouncedQuery]);

  // Run search when the debounced query / mode changes.
  useEffect(() => {
    let cancelled = false;
    if (searchMode === "sentence" || !debouncedQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);

    if (searchMode === "byComponent") {
      const matches = searchByComponent(
        debouncedQuery,
        saved.savedList.map((s) => s.word),
        charsData.chars,
      );
      (async () => {
        if (matches.length > 0) await dict.ensureCached(matches);
        if (cancelled) return;
        const hydrated = matches.map((w) => dict.findWord(w)).filter((w): w is Word => !!w);
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
  }, [debouncedQuery, searchMode, saved.savedList, charsData.chars, dict, setSearching]);

  // Pre-hydrate saved words so the shelf renders without per-card flicker.
  useEffect(() => {
    if (saved.saved.size === 0) return;
    void dict.ensureCached([...saved.saved]);
  }, [saved.saved, dict]);

  // Deep-link via hash on first (cold) load.
  const deepLinkRunRef = useRef(false);
  useEffect(() => {
    if (deepLinkRunRef.current) return;
    deepLinkRunRef.current = true;
    const initial = parseHash();
    if (initial) openFromHash(initial);
  }, [openFromHash]);

  // Auto-import via ?import=<url> on first load (same-origin only).
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
        const { added, total } = await saved.importSaved(items);
        const skipped = total - added;
        const skippedNote = skipped > 0 ? ` (${skipped} already saved)` : "";
        alert(`Imported ${added} word${added === 1 ? "" : "s"}${skippedNote}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Import failed: ${message}`);
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("import");
        window.history.replaceState({}, "", url.toString());
      }
    })();
  }, [auth.loading, saved]);

  // Auto-import via ?share=<value>.
  const autoShareRanRef = useRef(false);
  useEffect(() => {
    if (autoShareRanRef.current) return;
    if (auth.loading) return;
    autoShareRanRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("share");
    if (!value) return;

    (async () => {
      try {
        let items: string[] | null = null;
        if (looksLikeShareToken(value)) {
          try {
            const { data, error } = await supabase.rpc("get_shared_words", { p_token: value });
            if (!error && Array.isArray(data)) {
              const list = (data as unknown[]).filter(
                (x): x is string => typeof x === "string" && x.length > 0,
              );
              if (list.length > 0) items = list;
            }
          } catch {
            /* table/RPC missing, offline, etc. — fall through to inline decode */
          }
        }
        if (!items) items = decodeWords(value);
        if (!items) {
          alert("This share link looks broken, expired, or empty.");
          return;
        }
        const ok = window.confirm(
          `Someone shared ${items.length} word${items.length === 1 ? "" : "s"} with you. Add them to your saved list?`,
        );
        if (!ok) return;
        const { added, total } = await saved.importSaved(items);
        const skipped = total - added;
        const skippedNote = skipped > 0 ? ` (${skipped} already saved)` : "";
        alert(`Added ${added} word${added === 1 ? "" : "s"}${skippedNote}.`);
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("share");
        window.history.replaceState({}, "", url.toString());
      }
    })();
  }, [auth.loading, saved]);

  // Auto-clear via ?clear=1.
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
        const { cleared } = await saved.clearAll();
        alert(`Cleared ${cleared} saved word${cleared === 1 ? "" : "s"}.`);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("clear");
      window.history.replaceState({}, "", url.toString());
    })();
  }, [auth.loading, saved]);

  const handleEnter = () => {
    if (searchMode === "sentence") return;
    if (searchResults.length > 0) {
      void openWord(searchResults[0].word);
    }
  };

  const shareMyWords = () => {
    if (saved.savedList.length === 0) {
      alert("You haven't saved any words yet — nothing to share.");
      return;
    }
    const words = saved.savedList.map((s) => s.word);
    const label = `${words.length} word${words.length === 1 ? "" : "s"}`;
    void (async () => {
      let url = shareUrl(encodeWords(words));
      const uid = auth.user?.id;
      if (uid) {
        try {
          const token = makeShareToken();
          const { error } = await supabase
            .from("user_shares")
            .insert({ token, user_id: uid, words });
          if (!error) url = shareUrl(token);
        } catch {
          /* table missing / offline / collision — keep the inline link */
        }
      }
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "My Chinese words",
            text: `Here are ${label} I've saved — open the link to add them to your list.`,
            url,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        alert(
          `Share link copied (${label}). Send it to anyone — opening it adds these words to their saved list.`,
        );
      } catch {
        window.prompt(`Copy this link to share your ${label}:`, url);
      }
    })();
  };

  const openWord = async (word: string) => {
    await dict.ensureCached([word]);
    push({ kind: "word", key: word });
  };

  const openChar = (char: string) => push({ kind: "char", key: char });

  const top = stack[stack.length - 1];
  const topWord = top?.kind === "word" ? dict.findWord(top.key) : null;

  return (
    <AppStateProvider
      saved={{
        saved: saved.saved,
        savedList: saved.savedList,
        learned: saved.learned,
        wrote: saved.wrote,
        review: saved.review,
        getStatus: saved.getStatus,
        setStatus: saved.setStatus,
      }}
      dict={{
        findWord: dict.findWord,
        ensureCached: dict.ensureCached,
        search: dict.search,
        error: dict.error,
      }}
      chars={charsData}
      mnemonics={mnemonics}
      auth={{
        user: auth.user,
        loading: auth.loading,
        signInWithEmail: auth.signInWithEmail,
        signOut: auth.signOut,
      }}
    >
      <header className="topbar">
        <HamburgerMenu
          version="chinese v90"
          reviewHref="#/review"
          reviewBadge={dueCards.length}
          phoneticsHref="#/phonetics"
          onShareWords={shareMyWords}
          wordCount={saved.savedList.length}
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
          canCluster={saved.savedList.length >= 3}
          onStart={(s) => setReviewLaunched(s)}
          onStartCluster={() => setClusterActive(true)}
          onClose={() => closeHashPage("#/review")}
        />
      )}
      {showReview && clusterActive && (
        <ClusterRecall
          onGrade={(key, rating, kind, facet) => grade(key, rating, kind, facet)}
          onClose={() => setClusterActive(false)}
        />
      )}
      {showReview && reviewLaunched && (
        <ReviewPage
          dueCards={dueCards}
          cards={reviewState.cards}
          phoneticComponents={phonetics.components}
          phoneticComponentsByChar={phonetics.byChar}
          enabledFacets={new Set(reviewLaunched.enabledFacets)}
          randomOrder={reviewLaunched.randomOrder}
          includeSubchars={reviewLaunched.includeSubchars}
          onGrade={(key, rating, kind, facet) => grade(key, rating, kind, facet)}
          onAttributeFailure={(childKey) => attributeFailure(childKey)}
          onClose={() => closeHashPage("#/review")}
        />
      )}

      {showPhonetics && (
        <PhoneticsPage
          components={phonetics.components}
          ready={phonetics.ready}
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

      {searchMode === "sentence" ? (
        <main className="home" aria-label="Sentence">
          <SentenceStudio userId={auth.user?.id ?? null} externalQuery={debouncedQuery} />
        </main>
      ) : debouncedQuery.trim() ? (
        searching && searchResults.length === 0 ? (
          <div className="empty-state">Searching…</div>
        ) : (
          <ResultsList matches={searchResults} onOpen={(w) => void openWord(w)} />
        )
      ) : searchMode === "byComponent" && saved.saved.size > 0 ? (
        <ComponentTable
          savedWords={saved.savedList.map((s) => s.word)}
          chars={charsData.chars}
          onPick={(c) => setQuery(c)}
        />
      ) : (
        <main className="home" aria-label="Home">
          <SavedShelf onOpenWord={(w) => void openWord(w)} onOpenChar={openChar} />
        </main>
      )}

      {top && top.view === "tree" && (
        <TreeModal
          entry={top}
          word={topWord}
          stackLen={stack.length}
          onPop={pop}
          onNodeClick={openChar}
        />
      )}

      {top && top.view !== "tree" && (
        <EntitySheet
          word={top.kind === "word" ? topWord : null}
          charKey={top.key}
          onClose={pop}
          onOpenWord={(w) => void openWord(w)}
          onOpenChar={openChar}
          onOpenTree={() => push({ ...top, view: "tree" })}
        />
      )}

      {dict.error && <div className="error-banner">Dictionary error: {dict.error}</div>}
    </AppStateProvider>
  );
}
