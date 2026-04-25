import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

import { useDictionary } from "./hooks/useDictionary";
import { useChars } from "./hooks/useChars";
import { useSaved } from "./hooks/useSaved";
import { useModalStack, parseHash } from "./hooks/useModalStack";

import { SearchBar } from "./components/SearchBar";
import { SavedShelf } from "./components/SavedShelf";
import { HomeGrid } from "./components/HomeGrid";
import { ResultsList } from "./components/ResultsList";
import { TreeModal } from "./components/TreeModal";
import { CharPopup } from "./components/CharPopup";

import { rankResults } from "./lib/search";

const SEARCH_DEBOUNCE_MS = 90;

export function App() {
  const dict = useDictionary();
  const charsData = useChars();
  const { saved, toggle, exportSaved } = useSaved();
  const { stack, push, pop } = useModalStack();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [popupChar, setPopupChar] = useState<string | null>(null);

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

  // Deep-link via hash on first load.
  useEffect(() => {
    if (!dict.words) return;
    const initial = parseHash();
    if (!initial) return;
    if (initial.kind === "word" && dict.findWord(initial.key)) push(initial);
    else if (initial.kind === "char" && charsData.chars[initial.key]) push(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dict.words]);

  const matches = useMemo(() => {
    if (!debouncedQuery.trim() || !dict.words) return [];
    return rankResults(dict.words, debouncedQuery);
  }, [debouncedQuery, dict.words]);

  const handleEnter = () => {
    if (matches.length > 0) {
      push({ kind: "word", key: matches[0].word });
      return;
    }
    if (dict.words && dict.words.length > 0) {
      push({ kind: "word", key: dict.words[0].word });
    }
  };

  const openWord = (word: string) => push({ kind: "word", key: word });
  const openCharPopup = (char: string) => setPopupChar(char);

  const top = stack[stack.length - 1];
  const topWord = top?.kind === "word" ? dict.findWord(top.key) : null;

  if (!dict.words) {
    return (
      <div className="boot-loading" aria-live="polite">
        {dict.error ? `Failed to load dictionary: ${dict.error}` : "Loading dictionary…"}
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <span className="home-link" />
        <h1>中文</h1>
        <span className="spacer" />
      </header>

      <SearchBar value={query} onChange={setQuery} onEnter={handleEnter} />

      {debouncedQuery.trim() ? (
        <ResultsList matches={matches} onOpen={openWord} />
      ) : (
        <main className="home" aria-label="Home">
          <SavedShelf
            saved={saved}
            findWord={dict.findWord}
            chars={charsData.chars}
            onOpenWord={openWord}
            onOpenChar={openCharPopup}
            onExport={exportSaved}
          />
          <HomeGrid words={dict.words} onOpen={openWord} />
        </main>
      )}

      {top && (
        <TreeModal
          entry={top}
          word={topWord}
          chars={charsData.chars}
          stackLen={stack.length}
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
          onJumpToWord={openWord}
          findWord={dict.findWord}
        />
      )}

      <div className="page-id">chinese v13</div>
    </>
  );
}
