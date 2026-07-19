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
import { useWordInference } from "./hooks/useWordInference";
import { useSanzijing } from "./hooks/useSanzijing";
import { useClassicProgress } from "./hooks/useClassicProgress";
import { useAutoImport } from "./hooks/useAutoImport";
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
import { ClassicPage } from "./components/ClassicPage";
import { ReviewLaunch, type ReviewSettings } from "./components/ReviewLaunch";
import { SentenceStudio } from "./components/SentenceStudio";

import { AppStateProvider } from "./state/contexts";
import { useUIStore } from "./state/uiStore";
import { encodeWords, makeShareToken, shareUrl } from "./lib/share";

import type { Word, ModalEntry } from "./lib/types";
import { useState } from "react";
import { buildClusters } from "./lib/drillGen";

const SEARCH_DEBOUNCE_MS = 200;

export function App() {
  const dict = useDictionary();
  const charsData = useChars();
  const auth = useAuth();
  const saved = useSaved({ userId: auth.user?.id ?? null });
  const { stack, push, pop, close } = useModalStack();

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
  const showClassic = useUIStore((s) => s.showClassic);
  const setShowClassic = useUIStore((s) => s.setShowClassic);
  const showSignIn = useUIStore((s) => s.showSignIn);
  const setShowSignIn = useUIStore((s) => s.setShowSignIn);

  const [searchResults, setSearchResults] = useState<Word[]>([]);

  // Every saved word is queued for review — the user's stated goal is to
  // learn all of them, and the two statuses (★ saved → 🎓 learned,
  // ADR-0011) are about progression, not about what's scheduled.
  const scheduledKeys = saved.saved;

  const phonetics = usePhoneticComponents();
  const classic = useSanzijing();
  const classicProgress = useClassicProgress(auth.user?.id ?? null);
  const mnemonics = useMnemonics({ userId: auth.user?.id ?? null });

  const reviewState = useReview({
    userId: auth.user?.id ?? null,
    scheduledKeys,
    chars: charsData.chars,
    phoneticComponentsByChar: phonetics.byChar,
  });
  const { dueCards, grade, attributeFailure, recordInference } = reviewState;

  // Weakest-first shelf sort: per saved word, the lower of the two
  // recognition cards' FSRS stability (never-reviewed = 0 = weakest).
  const weakness = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of saved.savedList) {
      const meaning = reviewState.cards.get(`word|meaningRecognition|${e.word}`);
      const sound = reviewState.cards.get(`word|soundRecognition|${e.word}`);
      m.set(e.word, Math.min(meaning?.card.stability ?? 0, sound?.card.stability ?? 0));
    }
    return m;
  }, [saved.savedList, reviewState.cards]);

  // Drill 1 material: real unsaved words made of the user's known chars.
  const { words: inferenceWords, markSeen: markInferenceSeen } = useWordInference({
    userId: auth.user?.id ?? null,
    savedList: saved.savedList,
    ensureCached: dict.ensureCached,
    findWord: dict.findWord,
  });

  // Cluster-recall material (v107, a drill type since the standalone
  // page was folded into the session queue).
  const clusters = useMemo(
    () =>
      buildClusters(
        saved.savedList.map((s) => s.word),
        phonetics.byChar,
      ),
    [saved.savedList, phonetics.byChar],
  );

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

  // Track full-screen pages via URL hash + route #/c, #/w deep links.
  useEffect(() => {
    const onHash = () => {
      setShowReview(window.location.hash === "#/review");
      setShowPhonetics(window.location.hash === "#/phonetics");
      setShowClassic(window.location.hash === "#/classic");
      if (window.location.hash === "#/sentence") {
        setSearchMode("sentence");
        history.replaceState(history.state, "", location.pathname + location.search);
      }
      if (window.location.hash !== "#/review") {
        setReviewLaunched(null);
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
  }, [openFromHash, setShowReview, setShowPhonetics, setShowClassic, setSearchMode]);

  const closeHashPage = (target: string) => {
    if (window.location.hash === target) history.back();
    else {
      if (target === "#/review") setShowReview(false);
      if (target === "#/phonetics") setShowPhonetics(false);
      if (target === "#/classic") setShowClassic(false);
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
    // `dict` itself is a fresh object literal each render (the hook
    // doesn't memoize its return); depending on its stable function
    // refs only so this effect doesn't tear down + restart the
    // in-flight search on every render — that caused a "searches
    // forever" hang on a real user.
  }, [
    debouncedQuery,
    searchMode,
    saved.savedList,
    charsData.chars,
    dict.search,
    dict.ensureCached,
    dict.findWord,
    setSearching,
  ]);

  // Pre-hydrate saved words so the shelf renders without per-card flicker.
  useEffect(() => {
    if (saved.saved.size === 0) return;
    void dict.ensureCached([...saved.saved]);
    // Same stability story as the search effect — depend on the
    // ensureCached function ref only, not the whole dict object.
  }, [saved.saved, dict.ensureCached]);

  // Deep-link via hash on first (cold) load.
  const deepLinkRunRef = useRef(false);
  useEffect(() => {
    if (deepLinkRunRef.current) return;
    deepLinkRunRef.current = true;
    const initial = parseHash();
    if (initial) openFromHash(initial);
  }, [openFromHash]);

  useAutoImport({ saved, authLoading: auth.loading });

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
          version="chinese v107"
          reviewHref="#/review"
          reviewBadge={dueCards.length}
          phoneticsHref="#/phonetics"
          classicHref="#/classic"
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

      {showReview && !reviewLaunched && (
        <ReviewLaunch
          totalDue={dueCards.length}
          facetCounts={{
            ...dueCards.reduce<Record<string, number>>((acc, c) => {
              const f = c.facet === "recognition" ? "meaningRecognition" : c.facet;
              acc[f] = (acc[f] || 0) + 1;
              return acc;
            }, {}),
            wordInference: inferenceWords.length,
            clusterRecall: clusters.length,
          }}
          onStart={(s) => setReviewLaunched(s)}
          onClose={() => closeHashPage("#/review")}
        />
      )}
      {showReview && reviewLaunched && (
        <ReviewPage
          dueCards={dueCards}
          cards={reviewState.cards}
          inferenceWords={inferenceWords}
          onInferenceResult={(w, gotIt) => {
            markInferenceSeen(w);
            recordInference(w, gotIt);
          }}
          clusters={clusters}
          phoneticComponents={phonetics.components}
          phoneticComponentsByChar={phonetics.byChar}
          enabledFacets={new Set(reviewLaunched.enabledFacets)}
          randomOrder={reviewLaunched.randomOrder}
          includeSubchars={reviewLaunched.includeSubchars}
          onGrade={(key, rating, kind, facet) => grade(key, rating, kind, facet)}
          onAttributeFailure={(childKey) => attributeFailure(childKey)}
          onClose={() => setReviewLaunched(null)}
        />
      )}

      {showPhonetics && (
        <PhoneticsPage
          components={phonetics.components}
          ready={phonetics.ready}
          onClose={() => closeHashPage("#/phonetics")}
        />
      )}

      {showClassic && (
        <ClassicPage
          data={classic.data}
          error={classic.error}
          bookmarkIndex={classicProgress.index}
          onAdvance={classicProgress.advanceTo}
          onOpenChar={openChar}
          onClose={() => closeHashPage("#/classic")}
        />
      )}

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSignIn={(email) => auth.signInWithEmail(email)}
          onVerifyCode={(email, code) => auth.verifyEmailCode(email, code)}
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
          <SavedShelf
            onOpenWord={(w) => void openWord(w)}
            onOpenChar={openChar}
            weakness={weakness}
          />
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
          onClose={close}
          onBack={pop}
          canGoBack={stack.length > 1}
          onOpenWord={(w) => void openWord(w)}
          onOpenChar={openChar}
          onOpenTree={() => push({ ...top, view: "tree" })}
        />
      )}

      {dict.error && <div className="error-banner">Dictionary error: {dict.error}</div>}
    </AppStateProvider>
  );
}
