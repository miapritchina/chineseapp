import { useEffect, useMemo, useState } from "react";
import type { Char, Word } from "../lib/types";
import type { SavedEntry, Status } from "../hooks/useSaved";
import { Card, CharOnlyCard } from "./Card";
import { normalizePinyin } from "../lib/pinyin";

interface Props {
  savedList: SavedEntry[];
  learned: Set<string>;
  wrote: Set<string>;
  review: Set<string>;
  findWord: (key: string) => Word | null;
  chars: Record<string, Char>;
  onOpenWord: (word: string) => void;
  onOpenChar: (char: string) => void;
  getStatus?: (key: string) => Status | null;
  setStatus?: (key: string, next: Status | null) => void;
}

type SortMode = "recent" | "pinyin" | "strokes" | "hsk" | "common";
const SORT_KEY = "chinese.savedSort";
const SORT_LABELS: [SortMode, string][] = [
  ["recent", "Recent"],
  ["pinyin", "Pinyin"],
  ["strokes", "Strokes"],
  ["hsk", "HSK"],
  ["common", "Common"],
];

function loadSortMode(): SortMode {
  try {
    const v = localStorage.getItem(SORT_KEY);
    if (v === "pinyin" || v === "strokes" || v === "hsk" || v === "common" || v === "recent") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "recent";
}

function renderCard(
  entry: SavedEntry,
  findWord: (key: string) => Word | null,
  chars: Record<string, Char>,
  onOpenWord: (word: string) => void,
  onOpenChar: (char: string) => void,
  getStatus?: (key: string) => Status | null,
  setStatus?: (key: string, next: Status | null) => void,
) {
  const key = entry.word;
  const w = findWord(key);
  if (w) {
    return (
      <Card
        key={key}
        word={w}
        onOpen={onOpenWord}
        getStatus={getStatus}
        setStatus={setStatus}
      />
    );
  }
  const c = chars[key];
  if (c) {
    return (
      <CharOnlyCard
        key={key}
        charKey={key}
        pinyin={c.pinyin || ""}
        gloss={c.definitions?.[0] || ""}
        onOpen={onOpenChar}
        getStatus={getStatus}
        setStatus={setStatus}
      />
    );
  }
  // Cache miss (network in flight) — render a minimal placeholder so the grid
  // doesn't reflow when ensureCached resolves.
  return (
    <button
      key={key}
      className="card card-pending"
      type="button"
      onClick={() => onOpenWord(key)}
      aria-label={key}
    >
      <div className="char">{key}</div>
    </button>
  );
}

export function SavedShelf({
  savedList,
  learned,
  wrote,
  review,
  findWord,
  chars,
  onOpenWord,
  onOpenChar,
  getStatus,
  setStatus,
}: Props) {
  const isEmpty = savedList.length === 0;

  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode);
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sortMode);
    } catch {
      /* ignore */
    }
  }, [sortMode]);

  // Stroke-count cache. HanziWriter ships per-char stroke data over CDN —
  // fetch lazily when the user picks the "Strokes" sort, then re-render.
  const [strokeCounts, setStrokeCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (sortMode !== "strokes") return;
    const HW = (window as unknown as { HanziWriter?: { loadCharacterData: (c: string) => Promise<{ strokes?: string[] } | null> } }).HanziWriter;
    if (!HW) return;
    const needed = new Set<string>();
    for (const e of savedList) {
      for (const c of e.word) if (!strokeCounts.has(c)) needed.add(c);
    }
    if (needed.size === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        [...needed].map(async (c) => {
          try {
            const d = await HW.loadCharacterData(c);
            return [c, d?.strokes?.length ?? 0] as const;
          } catch {
            return [c, 0] as const;
          }
        }),
      );
      if (cancelled) return;
      setStrokeCounts((prev) => {
        const next = new Map(prev);
        for (const [c, n] of results) next.set(c, n);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [sortMode, savedList, strokeCounts]);

  // Pre-compute sort keys once per render; the inner comparator does
  // O(1) Map lookups instead of recomputing pinyin / hsk / rank / strokes
  // per pairwise comparison. Called from useMemo'd sortFor below.
  const sortKeys = useMemo(() => {
    const m = new Map<
      string,
      { pinyin: string; strokes: number; hsk: number; rank: number }
    >();
    for (const e of savedList) {
      const w = findWord(e.word);
      let pinyin = "";
      if (w) {
        pinyin = w.searchablePinyin || normalizePinyin(w.pinyin);
      } else {
        for (const ch of e.word) {
          const cd = chars[ch];
          if (cd?.pinyin) pinyin += normalizePinyin(cd.pinyin);
        }
      }
      let strokes = 0;
      let allKnown = true;
      for (const c of e.word) {
        const n = strokeCounts.get(c);
        if (n === undefined) {
          allKnown = false;
          break;
        }
        strokes += n;
      }
      m.set(e.word, {
        pinyin,
        strokes: allKnown ? strokes : Number.POSITIVE_INFINITY,
        hsk: w?.hsk ?? Number.POSITIVE_INFINITY,
        rank: w?.rank ?? Number.POSITIVE_INFINITY,
      });
    }
    return m;
  }, [savedList, findWord, chars, strokeCounts]);

  function sortList(list: SavedEntry[]): SavedEntry[] {
    if (sortMode === "recent") return list; // already newest-first from useSaved
    const arr = [...list];
    arr.sort((a, b) => {
      const ka = sortKeys.get(a.word);
      const kb = sortKeys.get(b.word);
      if (!ka || !kb) return 0;
      let cmp = 0;
      if (sortMode === "pinyin")   cmp = (ka.pinyin || "￿").localeCompare(kb.pinyin || "￿");
      else if (sortMode === "strokes") cmp = ka.strokes - kb.strokes;
      else if (sortMode === "hsk")     cmp = ka.hsk - kb.hsk;
      else if (sortMode === "common")  cmp = ka.rank - kb.rank;
      if (cmp !== 0) return cmp;
      return b.savedAt - a.savedAt; // stable tiebreak
    });
    return arr;
  }

  // Four mutually-exclusive status buckets. Order matches the dropdown:
  //   review (❗)   — needs more work
  //   wrote (✒)    — can write
  //   learned (🎓) — memorized
  //   saved (★)    — base / nothing else
  const reviewList: SavedEntry[] = [];
  const wroteList: SavedEntry[] = [];
  const learnedList: SavedEntry[] = [];
  const savedOnlyList: SavedEntry[] = [];
  for (const e of savedList) {
    if (wrote.has(e.word)) wroteList.push(e);
    else if (learned.has(e.word)) learnedList.push(e);
    else if (review.has(e.word)) reviewList.push(e);
    else savedOnlyList.push(e);
  }

  const sortedSavedOnly = sortList(savedOnlyList);
  const sortedReview = sortList(reviewList);
  const sortedLearned = sortList(learnedList);
  const sortedWrote = sortList(wroteList);
  const sortedAll = sortList(savedList);

  // Recent sort: keep things grouped by status section. Any other sort:
  // section split is meaningless (you'd be ordering across boundaries
  // anyway), so collapse into one flat grid.
  const sectioned = sortMode === "recent";

  return (
    <section className="saved-section">
      <div className="shelf-header">
        <div className="shelf-title">
          Saved
          {savedOnlyList.length > 0 && (
            <span className="shelf-count">· {savedOnlyList.length}</span>
          )}
        </div>
      </div>

      {!isEmpty && (
        <div className="sort-bar" role="tablist" aria-label="Sort saved words">
          {SORT_LABELS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sortMode === key}
              className={`sort-pill${sortMode === key ? " is-active" : ""}`}
              onClick={() => setSortMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="saved-empty">
          <div>No saved words yet.</div>
          <div className="saved-empty-hint">
            Search above to find a word, then tap ☆ to save it here.
          </div>
        </div>
      ) : !sectioned ? (
        <div className="saved-grid">
          {sortedAll.map((e) => renderCard(e, findWord, chars, onOpenWord, onOpenChar, getStatus, setStatus))}
        </div>
      ) : (
        <>
          {savedOnlyList.length > 0 ? (
            <div className="saved-grid">
              {sortedSavedOnly.map((e) => renderCard(e, findWord, chars, onOpenWord, onOpenChar, getStatus, setStatus))}
            </div>
          ) : (
            <div className="saved-empty">
              <div className="saved-empty-hint">
                Every saved word has a higher status. Save a new word to fill this section.
              </div>
            </div>
          )}

          {reviewList.length > 0 && (
            <>
              <div className="shelf-header shelf-header-secondary">
                <div className="shelf-title">
                  Need to learn
                  <span className="shelf-count">· {reviewList.length}</span>
                </div>
              </div>
              <div className="saved-grid">
                {sortedReview.map((e) => renderCard(e, findWord, chars, onOpenWord, onOpenChar, getStatus, setStatus))}
              </div>
            </>
          )}

          {learnedList.length > 0 && (
            <>
              <div className="shelf-header shelf-header-secondary">
                <div className="shelf-title">
                  Learned
                  <span className="shelf-count">· {learnedList.length}</span>
                </div>
              </div>
              <div className="saved-grid">
                {sortedLearned.map((e) => renderCard(e, findWord, chars, onOpenWord, onOpenChar, getStatus, setStatus))}
              </div>
            </>
          )}

          {wroteList.length > 0 && (
            <>
              <div className="shelf-header shelf-header-secondary">
                <div className="shelf-title">
                  Wrote
                  <span className="shelf-count">· {wroteList.length}</span>
                </div>
              </div>
              <div className="saved-grid">
                {sortedWrote.map((e) => renderCard(e, findWord, chars, onOpenWord, onOpenChar, getStatus, setStatus))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
