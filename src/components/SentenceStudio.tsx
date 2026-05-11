import { useEffect, useMemo, useState } from "react";
import type { Word } from "../lib/types";
import { POS_COLOR, POS_LABEL, detectPos, type Pos } from "../lib/pos";
import { useSentenceDraft } from "../hooks/useSentenceDraft";
import { speak } from "../lib/speech";

interface Props {
  // Saved-word keys (newest-first order from useSaved).
  savedWords: string[];
  // Resolved Word rows (lazy — anything still loading just doesn't
  // appear in the bank).
  findWord: (key: string) => Word | null;
  // Pre-hydrate so the bank has data on first paint after the page
  // opens with cards out of cache.
  ensureCached: (keys: string[]) => Promise<void>;
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

// Sentence Studio (E2): tap a saved word to append it to the composer,
// tap a composer token to remove it. POS tabs filter the bank. Drafts
// persist in localStorage; nothing here touches the SRS schedule.
//
// Design from claude.ai/design → "Hifi E2" handoff. Visual notes:
//   - Uses the app's existing palette (--bg, --surface-2, --accent),
//     not the handoff's vermillion / Fraunces stack. The "don't go
//     over the head" cue.
//   - POS color stripe on each chip + token shadow keeps the handoff's
//     functional color hint.
export function SentenceStudio({ savedWords, findWord, ensureCached, onClose }: Props) {
  const { keys, append, removeAt, clear } = useSentenceDraft();
  const [tab, setTab] = useState<Pos | "all">("all");
  const [copied, setCopied] = useState(false);

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

  const visible = useMemo(
    () => (tab === "all" ? bank : bank.filter((b) => b.pos === tab)),
    [bank, tab],
  );

  // Composer tokens = the draft keys resolved through findWord. Lookup
  // happens on every render; cheap (Map.get).
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
                onClick={clear}
                disabled={empty}
                aria-label="Clear sentence"
              >
                clear
              </button>
            </div>
            <div
              className={`composer-canvas${empty ? " is-empty" : ""}`}
              role="group"
              aria-label="Sentence in progress"
            >
              {empty ? (
                <div className="composer-placeholder">
                  Tap words below to start building.
                </div>
              ) : (
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
                </div>
              )}
            </div>
            <div className="composer-foot">
              <span className="composer-pinyin">
                {empty ? "—" : sentencePinyin}
              </span>
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

          <div className="word-bank">
            {visible.length === 0 ? (
              <div className="review-empty-hint" style={{ padding: "20px 16px" }}>
                No saved {tab === "all" ? "words" : POS_LABEL[tab]} yet.
              </div>
            ) : (
              visible.map(({ word, pos }) => (
                <button
                  key={word.word}
                  type="button"
                  className="bank-chip"
                  style={{ ["--pos-c" as never]: POS_COLOR[pos] }}
                  onClick={() => append(word.word)}
                >
                  <span className="bank-chip-c">{word.word}</span>
                  <span className="bank-chip-meta">
                    <span className="bank-chip-p">{word.pinyin}</span>
                    <span className="bank-chip-g">
                      {(word.definitions?.[0] || "").slice(0, 40)}
                    </span>
                  </span>
                  <span className="bank-chip-pos">{POS_LABEL[pos]}</span>
                </button>
              ))
            )}
          </div>

          <div className="sentence-cta-wrap">
            <button
              type="button"
              className="sentence-cta"
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
