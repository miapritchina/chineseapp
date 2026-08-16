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
import { ExplorePage, type ExploreFocus } from "./components/ExplorePage";
import { ClassicPage } from "./components/ClassicPage";
import {
  ReviewLaunch,
  loadSettings,
  loadStartSettings,
  type ReviewSettings,
} from "./components/ReviewLaunch";
import { LearnPage } from "./components/LearnPage";
import { SiftPage } from "./components/SiftPage";
import { FocusPage } from "./components/FocusPage";
import { SentenceStudio } from "./components/SentenceStudio";
import { StatsPage } from "./components/StatsPage";
import { ForgePage } from "./components/ForgePage";
import { PairsPage } from "./components/PairsPage";
import { ChainPage } from "./components/ChainPage";
import { forgeWordPool } from "./lib/forge";
import { PAIRS_PER_BOARD } from "./lib/pairs";
import { chainPool, pickChainStart } from "./lib/chain";

import { AppStateProvider } from "./state/contexts";
import { useUIStore } from "./state/uiStore";
import { encodeWords, makeShareToken, shareUrl } from "./lib/share";

import type { Word, ModalEntry } from "./lib/types";
import { useState } from "react";
import { buildClusters } from "./lib/drillGen";
import { learnPool } from "./lib/learn";
import { siftDayKey, siftPool } from "./lib/sift";
import { problemWords, FOCUS_POOL } from "./lib/focus";
import { isDue } from "./lib/fsrs";
import { planFlow, LEARN_STAGE_COUNT, type FlowStage } from "./lib/flow";
import { setAutoSpeakEnabled } from "./lib/speech";

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
  const showExplore = useUIStore((s) => s.showExplore);
  const setShowExplore = useUIStore((s) => s.setShowExplore);
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
  const {
    dueCards,
    grade,
    gradeCluster,
    snoozeItem,
    attributeFailure,
    recordInference,
    creditPassiveView,
  } = reviewState;

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

  // Learn-mode material (v110): never-reviewed words first, then
  // weakest — see lib/learn.ts.
  const learnableWords = useMemo(
    () =>
      learnPool(saved.savedList, (w) => {
        const m = reviewState.cards.get(`word|meaningRecognition|${w}`);
        if (!m || (m.card.reps ?? 0) === 0) return null;
        return m.card.stability ?? 0;
      }),
    [saved.savedList, reviewState.cards],
  );

  // Stats page (v115): routed via #/stats like the other full pages.
  const [showStats, setShowStats] = useState<boolean>(
    () => typeof window !== "undefined" && window.location.hash === "#/stats",
  );

  // Sift mode (v113): the active triage deck; null = not sifting.
  const [siftWords, setSiftWords] = useState<string[] | null>(null);
  // Focus mode (v127): the active problem-word session; null = closed.
  const [focusWords, setFocusWords] = useState<string[] | null>(null);
  // Problem words: seen ≥8 times, still lapsing, stability < 7d —
  // ranked worst first (lib/focus.ts).
  const problemPool = useMemo(() => {
    const FACETS = ["meaningRecognition", "soundRecognition", "reverseRecognition", "clozeChar"];
    return problemWords(
      saved.savedList.map((s) => s.word),
      (w) => {
        const rows = [];
        for (const facet of FACETS) {
          const r = reviewState.cards.get(`word|${facet}|${w}`);
          if (!r) continue;
          rows.push({
            reps: r.card.reps ?? 0,
            lapses: r.card.lapses ?? 0,
            stability: r.card.stability ?? 0,
          });
        }
        return rows;
      },
    );
  }, [saved.savedList, reviewState.cards]);
  // Words left-swiped in Sift today — hidden from Sift until tomorrow,
  // still due everywhere else. Per-day ephemeral, so localStorage-only
  // (same carve-out as the old per-day new-card counter).
  const [siftKept, setSiftKept] = useState<Set<string>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("chinese.siftKept") ?? "null");
      if (raw && raw.day === siftDayKey() && Array.isArray(raw.items)) return new Set(raw.items);
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const keepInSift = (word: string) => {
    setSiftKept((prev) => {
      const next = new Set(prev);
      next.add(word);
      try {
        localStorage.setItem(
          "chinese.siftKept",
          JSON.stringify({ day: siftDayKey(), items: [...next] }),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Sift material (v113): due words, strongest first (weakness map =
  // min recognition stability, so high = well known).
  const siftableWords = useMemo(() => {
    const dueKeys = new Set<string>();
    for (const row of reviewState.cards.values()) {
      if (isDue(row.card)) dueKeys.add(row.itemKey);
    }
    return siftPool(
      saved.savedList.map((s) => s.word),
      dueKeys,
      (w) => weakness.get(w) ?? 0,
      siftKept,
    );
  }, [saved.savedList, reviewState.cards, weakness, siftKept]);

  // Stats page material (v115): words with anything due right now
  // (unlike siftableWords, today's left-swipes still count as due).
  const dueWordCount = useMemo(() => {
    const savedSet = new Set(saved.savedList.map((s) => s.word));
    const due = new Set<string>();
    for (const row of reviewState.cards.values()) {
      if (savedSet.has(row.itemKey) && isDue(row.card)) due.add(row.itemKey);
    }
    return due.size;
  }, [saved.savedList, reviewState.cards]);

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

  // Apply persisted display/sound prefs on load.
  useEffect(() => {
    setAutoSpeakEnabled(loadSettings().autoSpeak);
  }, []);
  // Brush-form hanzi (v114): Kaiti is built into iOS/macOS, so this is
  // a font swap on the big glyphs. Display pref only — localStorage,
  // not user data. Native Kai fonts are "document support only" on
  // iOS (invisible to Safari CSS — the v114 toggle silently did
  // nothing there), so enabling the toggle also loads the LXGW WenKai
  // webfont: unicode-range-sliced woff2 from jsdelivr, so only the
  // slices for glyphs actually on screen download, and the existing
  // SW jsdelivr rule caches them for offline.
  const [brushFont, setBrushFont] = useState<boolean>(() => {
    try {
      return localStorage.getItem("chinese.brushFont") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("brush-hanzi", brushFont);
    if (brushFont && !document.getElementById("brush-font-css")) {
      const link = document.createElement("link");
      link.id = "brush-font-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css";
      document.head.appendChild(link);
    }
    try {
      localStorage.setItem("chinese.brushFont", brushFont ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [brushFont]);

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
  // "Explore from here" target handed from the EntitySheet.
  const [exploreFocus, setExploreFocus] = useState<ExploreFocus | null>(null);
  // Learn mode (v110): the active lesson's words; null = no lesson.
  const [learnWords, setLearnWords] = useState<string[] | null>(null);
  // Games (v116): pure play, launched from the review launch screen.
  const [gameOpen, setGameOpen] = useState<"forge" | "pairs" | "chain" | null>(null);
  const forgeReady = useMemo(
    () => forgeWordPool(saved.savedList.map((s) => s.word)).length >= 4,
    [saved.savedList],
  );
  // Pairs material: due words first, the rest of the shelf after.
  const pairsPool = useMemo(
    () => [...new Set([...siftableWords, ...saved.savedList.map((s) => s.word)])],
    [siftableWords, saved.savedList],
  );
  const chainReady = useMemo(() => {
    const pool = chainPool(saved.savedList.map((s) => s.word));
    return pool.length >= 5 && pickChainStart(pool, () => 0) !== null;
  }, [saved.savedList]);

  // "Just start" flow (v114): the stages still ahead of the active one.
  // Non-empty ⇒ the current stage auto-advances into the next when its
  // deck drains.
  const [flowQueue, setFlowQueue] = useState<FlowStage[]>([]);

  const openStage = (stage: FlowStage) => {
    if (stage === "review") setReviewLaunched(loadStartSettings());
    else setLearnWords(learnableWords.slice(0, LEARN_STAGE_COUNT));
  };
  const justStart = () => {
    const stages = planFlow(learnableWords.length);
    setFlowQueue(stages.slice(1));
    openStage(stages[0]);
  };
  // The LAST stage keeps its natural end screen (onComplete is only
  // wired while a next stage exists), so the flow finishes on a real
  // "done" note instead of vanishing.
  const advanceFlow = () => {
    setSiftWords(null);
    setReviewLaunched(null);
    setLearnWords(null);
    const [next, ...rest] = flowQueue;
    setFlowQueue(rest);
    if (next) openStage(next);
  };
  const cancelFlow = () => setFlowQueue([]);
  // Track full-screen pages via URL hash + route #/c, #/w deep links.
  useEffect(() => {
    const onHash = () => {
      setShowReview(window.location.hash === "#/review");
      setShowExplore(window.location.hash === "#/explore");
      setShowClassic(window.location.hash === "#/classic");
      setShowStats(window.location.hash === "#/stats");
      if (window.location.hash === "#/sentence") {
        setSearchMode("sentence");
        history.replaceState(history.state, "", location.pathname + location.search);
      }
      if (window.location.hash !== "#/review") {
        setReviewLaunched(null);
        setLearnWords(null);
        setSiftWords(null);
        setFlowQueue([]);
        setGameOpen(null);
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
  }, [openFromHash, setShowReview, setShowExplore, setShowClassic, setSearchMode]);

  const closeHashPage = (target: string) => {
    if (window.location.hash === target) history.back();
    else {
      if (target === "#/review") setShowReview(false);
      if (target === "#/explore") setShowExplore(false);
      if (target === "#/classic") setShowClassic(false);
      if (target === "#/stats") setShowStats(false);
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
          // Profile link (v110): ONE stable token per account — the
          // recipient resolves it to the LIVE saved set, so a link
          // shared once keeps tracking the profile. Reuse the oldest
          // row; refresh its snapshot for pre-v110 recipients.
          const { data } = await supabase
            .from("user_shares")
            .select("token")
            .eq("user_id", uid)
            .order("created_at", { ascending: true })
            .limit(1);
          let token: string | undefined = data?.[0]?.token;
          if (token) {
            void supabase.from("user_shares").update({ words }).eq("token", token);
          } else {
            token = makeShareToken();
            const { error } = await supabase
              .from("user_shares")
              .insert({ token, user_id: uid, words });
            if (error) token = undefined;
          }
          if (token) url = shareUrl(token);
        } catch {
          /* table missing / offline — keep the inline snapshot link */
        }
      }
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: "My Chinese words",
            text: `My Chinese profile — ${label}. Open the link to import them into your list.`,
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

  // Reading a saved item's sheet counts as a partial repetition
  // (v108): a small capped schedule credit, throttled to once per
  // item per day — browsing is study, just not a full answer. NOT
  // during a review session (v110): exploring the current card would
  // push its due date out and silently drop it from the queue before
  // it was graded.
  useEffect(() => {
    if (reviewLaunched) return;
    if (!top || top.view === "tree") return;
    if (!saved.saved.has(top.key)) return;
    creditPassiveView(top.key);
  }, [top, saved.saved, creditPassiveView, reviewLaunched]);

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
          version="chinese v132"
          reviewHref="#/review"
          reviewBadge={dueCards.length}
          exploreHref="#/explore"
          classicHref="#/classic"
          statsHref="#/stats"
          onShareWords={shareMyWords}
          wordCount={saved.savedList.length}
          brushFont={brushFont}
          onToggleBrushFont={() => setBrushFont((v) => !v)}
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

      {showReview && !reviewLaunched && !learnWords && !siftWords && !focusWords && !gameOpen && (
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
          learnCount={learnableWords.length}
          onStartLearn={(size) => setLearnWords(learnableWords.slice(0, size ?? undefined))}
          siftCount={siftableWords.length}
          onStartSift={() => setSiftWords(siftableWords)}
          focusCount={problemPool.length}
          onStartFocus={() => setFocusWords(problemPool.slice(0, FOCUS_POOL))}
          onJustStart={justStart}
          forgeReady={forgeReady}
          onStartForge={() => setGameOpen("forge")}
          pairsReady={pairsPool.length >= PAIRS_PER_BOARD}
          onStartPairs={() => setGameOpen("pairs")}
          chainReady={chainReady}
          onStartChain={() => setGameOpen("chain")}
          onStart={(s) => setReviewLaunched(s)}
          onClose={() => closeHashPage("#/review")}
        />
      )}
      {showReview && gameOpen === "forge" && (
        <ForgePage
          onClose={() => setGameOpen(null)}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
        />
      )}
      {showReview && gameOpen === "chain" && (
        <ChainPage
          onClose={() => setGameOpen(null)}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
        />
      )}
      {showReview && gameOpen === "pairs" && (
        <PairsPage
          words={pairsPool}
          onClose={() => setGameOpen(null)}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
        />
      )}
      {showReview && focusWords && (
        <FocusPage
          words={focusWords}
          onClose={() => setFocusWords(null)}
          onGrade={(key, rating, kind, facet, score) => grade(key, rating, kind, facet, score)}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
          onOpenTree={(key) =>
            push({ kind: [...key].length > 1 ? "word" : "char", key, view: "tree" })
          }
          onExplore={(kind, key) => {
            setFocusWords(null);
            setExploreFocus({ kind, key });
            window.location.hash = "#/explore";
          }}
        />
      )}
      {showReview && siftWords && (
        <SiftPage
          words={siftWords}
          onClose={() => {
            cancelFlow();
            setSiftWords(null);
          }}
          onComplete={flowQueue.length > 0 ? advanceFlow : undefined}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
          onKnow={(w) => {
            // Good on every facet of this word that is due right now —
            // "counts as repeated in all workouts today". Non-due rows
            // are untouched (they weren't in today's workouts anyway).
            // Production is exempt (rebalance stage 2): a recognition
            // self-report can't clear a writing card.
            const now = new Date();
            for (const row of reviewState.cards.values()) {
              if (row.facet === "production") continue;
              if (row.itemKey === w && isDue(row.card, now)) {
                grade(w, "Good", row.itemKind, row.facet);
              }
            }
          }}
          onKeep={(w) => keepInSift(w)}
          onLessonDone={(w) => {
            // Same "introduced" credit Learn mode gives, plus a floor:
            // every still-due row moves to tomorrow — the user just
            // studied the word, re-testing it today measures nothing.
            creditPassiveView(w);
            snoozeItem(w);
          }}
          onExplore={(kind, key) => {
            cancelFlow();
            setSiftWords(null);
            setExploreFocus({ kind, key });
            window.location.hash = "#/explore";
          }}
          onOpenTree={(key) =>
            push({ kind: [...key].length > 1 ? "word" : "char", key, view: "tree" })
          }
        />
      )}
      {showReview && learnWords && (
        <LearnPage
          words={learnWords}
          onClose={() => {
            cancelFlow();
            setLearnWords(null);
          }}
          onComplete={flowQueue.length > 0 ? advanceFlow : undefined}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
          onOpenTree={(key) =>
            push({ kind: [...key].length > 1 ? "word" : "char", key, view: "tree" })
          }
          onExplore={(kind, key) => {
            cancelFlow();
            setLearnWords(null);
            setExploreFocus({ kind, key });
            window.location.hash = "#/explore";
          }}
          onIntroduced={(w) => creditPassiveView(w)}
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
          sessionSize={reviewLaunched.sessionSize}
          onGrade={(key, rating, kind, facet, score) => grade(key, rating, kind, facet, score)}
          onGradeCluster={gradeCluster}
          onAttributeFailure={(childKey) => attributeFailure(childKey)}
          onClose={() => {
            cancelFlow();
            setReviewLaunched(null);
          }}
          onComplete={flowQueue.length > 0 ? advanceFlow : undefined}
          onOpenEntity={(key) => {
            if ([...key].length > 1) void openWord(key);
            else openChar(key);
          }}
        />
      )}

      {showExplore && (
        <ExplorePage
          key={exploreFocus ? `${exploreFocus.kind}|${exploreFocus.key}` : "index"}
          components={phonetics.components}
          componentsByChar={phonetics.byChar}
          ready={phonetics.ready}
          initialFocus={exploreFocus}
          onClose={() => {
            setExploreFocus(null);
            closeHashPage("#/explore");
          }}
          onOpenSheet={(kind, key) => {
            if (kind === "word") void openWord(key);
            else openChar(key);
          }}
        />
      )}

      {showStats && (
        <StatsPage
          userId={auth.user?.id ?? null}
          totalWords={saved.savedList.length}
          learnedCount={saved.learned.size}
          dueCount={dueWordCount}
          stabilities={saved.savedList.map((e) => weakness.get(e.word) ?? 0)}
          onClose={() => closeHashPage("#/stats")}
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
          onExplore={(kind, key) => {
            close();
            setExploreFocus({ kind, key });
            window.location.hash = "#/explore";
          }}
        />
      )}

      {dict.error && <div className="error-banner">Dictionary error: {dict.error}</div>}
    </AppStateProvider>
  );
}
