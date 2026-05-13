import { useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "../lib/types";
import { POS_COLOR, POS_LABEL, detectPos, type Pos } from "../lib/pos";
import { normalizePinyin, HAN_RE } from "../lib/pinyin";
import { useSentenceDraft } from "../hooks/useSentenceDraft";
import { useSavedSentences } from "../hooks/useSavedSentences";
import { speak } from "../lib/speech";
import { hanziScaleStyle } from "../lib/hanzi";

interface Props {
  // Saved-word keys (newest-first order from useSaved).
  savedWords: string[];
  // Resolved Word rows (lazy — anything still loading just doesn't
  // appear in the bank).
  findWord: (key: string) => Word | null;
  // Pre-hydrate so the bank has data on first paint after the page
  // opens with cards out of cache.
  ensureCached: (keys: string[]) => Promise<void>;
  // Signed-in user id (null = signed out) — so the draft + saved
  // sentences sync to Supabase.
  userId: string | null;
  onClose: () => void;
}

const TABS: { id: Pos | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pron", label: "Pronoun" },
  { id: "v", label: "Verb" },
  { id: "n", label: "Noun" },
  { id: "adj", label: "Adjective" },
  { id: "adv", label: "Adverb" },
  { id: "part", label: "Particle" },
];

// Does this word match a typed query? Pinyin queries (no Han chars) match
// against the tone-stripped searchable pinyin; queries containing Han
// chars match against the hanzi. Substring match either way — forgiving.
function matchesQuery(w: Word, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;
  if (HAN_RE.test(q)) return w.word.includes(q);
  const nq = normalizePinyin(q);
  if (!nq) return true;
  const np = w.searchablePinyin ? normalizePinyin(w.searchablePinyin) : normalizePinyin(w.pinyin);
  return np.includes(nq);
}

// Sentence Studio (E2): build a sentence from your saved words. Tap a
// chip to append a token, tap a composer token to remove it. Type
// pinyin into the composer to filter the bank to matching words; tap a
// match and the typed pinyin is replaced by that word's token. POS tabs
// filter the bank when not searching. Save sentences locally; nothing
// here touches the SRS schedule.
//
// Visual notes: uses the app palette (--bg / --surface-2 / --accent),
// not the handoff's vermillion / Fraunces stack. POS color stripe on
// each chip + token keeps the handoff's functional color hint.
export function SentenceStudio({ savedWords, findWord, ensureCached, userId, onClose }: Props) {
  const { keys, append, removeAt, clear, replace } = useSentenceDraft({ userId });
  const sentences = useSavedSentences({ userId });
  const [tab, setTab] = useState<Pos | "all">("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Warm the dictionary cache for everything the bank wants to render.
  useEffect(() => {
    if (savedWords.length === 0) return;
    void ensureCached(savedWords);
  }, [savedWords, ensureCached]);

  // Resolve saved keys → Word rows, drop any that haven't hydrated yet
  // or are unsaved-by-default (e.g. ?clear=1 mid-session).
  const bank = useMemo(() => {
    const rows: { word: Word; pos: Pos }[] = [];
    for (const key of savedWords) {
      const w = findWord(key);
      if (!w) continue;
      rows.push({ word: w, pos: detectPos(w) });
    }
    return rows;
  }, [savedWords, findWord]);

  // Per-tab counts include "all" + each detected POS.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bank.length };
    for (const { pos } of bank) c[pos] = (c[pos] || 0) + 1;
    return c;
  }, [bank]);

  const q = query.trim();
  const searching = q.length > 0;
  // When the user is typing pinyin, the bank shows matches across ALL
  // saved words (the POS tab is ignored — "search through everything").
  const visible = useMemo(() => {
    if (searching) return bank.filter(({ word }) => matchesQuery(word, q));
    return tab === "all" ? bank : bank.filter((b) => b.pos === tab);
  }, [bank, tab, searching, q]);

  // Composer tokens = the draft keys resolved through findWord.
  const tokens = useMemo(
    () =>
      keys
        .map((k) => findWord(k))
        .filter((w): w is Word => !!w)
        .map((w) => ({ word: w, pos: detectPos(w) })),
    [keys, findWord],
  );
  const empty = tokens.length === 0;
  const sentencePinyin = tokens.map((t) => t.word.pinyin).join(" ");
  const sentenceHanzi = tokens.map((t) => t.word.word).join("");

  const addWord = (w: string) => {
    append(w);
    setQuery("");
    inputRef.current?.focus();
  };

  const handleCopy = async () => {
    if (empty) return;
    try {
      await navigator.clipboard.writeText(sentenceHanzi);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = sentenceHanzi;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleSave = () => {
    if (empty) return;
    sentences.add({ keys, hanzi: sentenceHanzi, pinyin: sentencePinyin });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && query === "" && tokens.length > 0) {
      removeAt(tokens.length - 1);
    } else if (e.key === "Enter" && searching && visible.length > 0) {
      e.preventDefault();
      addWord(visible[0].word.word);
    } else if (e.key === "Escape" && query !== "") {
      e.preventDefault();
      setQuery("");
    }
  };

  return (
    <div className="sentence-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-kind-tag">Sentence</span>
        <span className="review-progress">{bank.length} saved</span>
      </div>

      {savedWords.length === 0 ? (
        <div className="review-empty">
          <div className="review-empty-title">Save 5 words to start composing.</div>
          <div className="review-empty-hint">
            The Sentence Studio pulls from your saved set. Find a word
            via Search, save it, then come back.
          </div>
        </div>
      ) : (
        <>
          <div className="composer">
            <div className="composer-header">
              <span className="composer-label">Sentence</span>
              <button
                type="button"
                className="composer-clear"
                onClick={() => {
                  clear();
                  setQuery("");
                }}
                disabled={empty}
                aria-label="Clear sentence"
              >
                clear
              </button>
            </div>
            <div className="composer-canvas" role="group" aria-label="Sentence in progress">
              <div className="composer-tokens">
                {tokens.map((t, i) => (
                  <button
                    key={`${t.word.word}-${i}`}
                    type="button"
                    className="composer-token"
                    style={{ ["--pos-c" as never]: POS_COLOR[t.pos] }}
                    onClick={() => removeAt(i)}
                    aria-label={`Remove ${t.word.word}`}
                  >
                    <span className="composer-token-c">{t.word.word}</span>
                    <span className="composer-token-p">{t.word.pinyin}</span>
                  </button>
                ))}
                <input
                  ref={inputRef}
                  type="text"
                  className="composer-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder={
                    empty ? "Type pinyin, or tap a word below…" : "+ pinyin…"
                  }
                  aria-label="Add a word by typing pinyin"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="composer-foot">
              <span className="composer-pinyin">{empty ? "—" : sentencePinyin}</span>
              {!empty && (
                <button
                  type="button"
                  className="composer-speak"
                  aria-label="Play sentence"
                  onClick={() => speak(sentenceHanzi)}
                >
                  🔊
                </button>
              )}
            </div>
          </div>

          {sentences.items.length > 0 && (
            <div className="saved-sentences">
              <div className="saved-sentences-head">Saved sentences</div>
              <div className="saved-sentences-list">
                {sentences.items.map((s) => (
                  <div key={s.hanzi} className="saved-sentence-row">
                    <button
                      type="button"
                      className="saved-sentence-load"
                      onClick={() => {
                        replace(s.keys);
                        setQuery("");
                      }}
                      title="Load into the composer"
                    >
                      <span className="saved-sentence-hanzi">{s.hanzi}</span>
                      <span className="saved-sentence-pinyin">{s.pinyin}</span>
                    </button>
                    <button
                      type="button"
                      className="saved-sentence-del"
                      aria-label={`Delete saved sentence ${s.hanzi}`}
                      onClick={() => sentences.remove(s.hanzi)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!searching && (
            <div className="pos-tabs" role="tablist" aria-label="Filter word bank by part of speech">
              {TABS.map((t) => {
                const n = counts[t.id] || 0;
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`pos-tab${isActive ? " is-active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    <span>{t.label}</span>
                    <span className="pos-tab-count">{n}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="word-bank">
            {visible.length === 0 ? (
              <div className="review-empty-hint" style={{ padding: "20px 16px" }}>
                {searching
                  ? `No saved word matches “${q}”.`
                  : `No saved ${tab === "all" ? "words" : POS_LABEL[tab]} yet.`}
              </div>
            ) : (
              visible.map(({ word, pos }) => (
                <button
                  key={word.word}
                  type="button"
                  className="bank-chip"
                  title={POS_LABEL[pos]}
                  style={{ ...hanziScaleStyle(word.word), ["--pos-c" as never]: POS_COLOR[pos] }}
                  onClick={() => addWord(word.word)}
                >
                  <span className="bank-chip-c">{word.word}</span>
                  <span className="bank-chip-meta">
                    <span className="bank-chip-p">{word.pinyin}</span>
                    <span className="bank-chip-g">
                      {(word.definitions?.[0] || "").slice(0, 40)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="sentence-cta-wrap">
            <button
              type="button"
              className="sentence-cta"
              onClick={handleSave}
              disabled={empty}
            >
              {savedFlash ? "✓ Saved" : "Save sentence"}
            </button>
            <button
              type="button"
              className="sentence-cta sentence-cta-2nd"
              onClick={handleCopy}
              disabled={empty}
            >
              {copied ? "✓ Copied" : "Copy to clipboard"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
