import { useEffect, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { MnemonicEntry } from "../lib/mnemonics";
import { buildStarterWordMnemonic } from "../lib/mnemonics";
import { speak } from "../lib/speech";

interface Props {
  word: Word;
  chars: Record<string, Char>;
  getMnemonic: (key: string) => MnemonicEntry | null;
  saveMnemonic: (key: string, text: string) => void;
  clearMnemonic: (key: string) => void;
}

// One-line frequency band for the corpus rank. Brief said "no HSK, but
// add hint" — this is the hint. Ranges loosely follow the
// chinese-lexicon rank distribution.
function commonnessLabel(rank: number | null | undefined): string | null {
  if (rank == null) return null;
  if (rank < 1000) return "Top 1 000";
  if (rank < 3000) return "Top 3 000";
  if (rank < 10000) return "Top 10 000";
  return "Less common";
}

// Extract tone numbers from a tone-marked pinyin string. We map each
// vowel + combining mark sequence to its tone number (1–4) and 0 for
// neutral. Best-effort — falls back to "?" per syllable when a vowel
// has no recognized mark.
//
// Examples:
//   "xīn nián"   → "1 2"
//   "shàng hǎi"  → "4 3"
//   "ma ma"      → "0 0"
const TONE_MAP: Record<string, number> = {
  "̄": 1, // macron
  "́": 2, // acute
  "̌": 3, // caron
  "̀": 4, // grave
};
function tonePattern(pinyin: string): string {
  if (!pinyin) return "";
  // Split on whitespace; pinyin in our data is space-separated per syllable.
  const syllables = pinyin
    .normalize("NFD")
    .split(/\s+/)
    .filter(Boolean);
  if (syllables.length === 0) return "";
  return syllables
    .map((s) => {
      for (const ch of s) {
        if (ch in TONE_MAP) return String(TONE_MAP[ch]);
      }
      // No combining mark → neutral or no-tone.
      return "0";
    })
    .join(" ");
}

export function WordDetail({
  word,
  chars,
  getMnemonic,
  saveMnemonic,
  clearMnemonic,
}: Props) {
  // Skip rendering for single-char "words" — CharPopup owns that surface.
  const isMultiChar = [...word.word].length > 1;
  if (!isMultiChar) return null;

  const defs = (word.definitions || []).join("; ");
  const common = commonnessLabel(word.rank);
  const tones = tonePattern(word.pinyin || "");
  const starter = buildStarterWordMnemonic(
    word.word,
    word.pinyin || "",
    word.definitions?.[0] || "",
    chars,
  );

  const stored = getMnemonic(word.word);
  const [mnemonic, setMnemonic] = useState<string>(() => stored?.text ?? starter);
  const [editedFlag, setEditedFlag] = useState<boolean>(() => !!stored?.edited);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const s = getMnemonic(word.word);
    setMnemonic(s?.text ?? starter);
    setEditedFlag(!!s?.edited);
    setEditing(false);
    // Re-derive only when the word key changes (component is reused
    // across modal opens for different words). starter/getMnemonic are
    // referentially unstable across renders, but the effect doesn't need
    // to re-fire on those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.word]);

  const persist = (text: string) => {
    if (text === starter && !editedFlag) {
      clearMnemonic(word.word);
      return;
    }
    saveMnemonic(word.word, text);
    setEditedFlag(true);
  };
  const reset = () => {
    clearMnemonic(word.word);
    setMnemonic(starter);
    setEditedFlag(false);
    setEditing(false);
  };

  return (
    <div className="word-detail">
      <div className="word-detail-defs">{defs || "(no definitions)"}</div>
      <div className="word-detail-meta">
        {tones && (
          <span className="word-detail-tone" title="Tone pattern">
            {tones}
          </span>
        )}
        {common && (
          <span className="word-detail-common" title="Corpus frequency band">
            {common}
          </span>
        )}
        <button
          type="button"
          className="word-detail-speak"
          aria-label={`Play ${word.word}`}
          onClick={() => speak(word.word)}
        >
          🔊
        </button>
      </div>

      <div className="mnemonic-block word-detail-mnemonic">
        <div className="mnemonic-header">
          <span className="mnemonic-title">
            💡 Make it stick {editedFlag && <span className="mnemonic-saved-tag">your version</span>}
          </span>
          {editedFlag && (
            <button
              type="button"
              className="mnemonic-reset"
              onClick={reset}
              title="Reset to the auto-suggested word mnemonic"
            >
              reset
            </button>
          )}
        </div>
        {editing ? (
          <textarea
            className="mnemonic-textarea"
            value={mnemonic}
            autoFocus
            onChange={(e) => setMnemonic(e.target.value)}
            onBlur={() => {
              persist(mnemonic);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
            rows={3}
            placeholder="Image, story, hook — anything that makes this word stick…"
          />
        ) : (
          <button
            type="button"
            className={`mnemonic-display${editedFlag ? " is-edited" : " is-default"}`}
            onClick={() => setEditing(true)}
            title="Tap to edit"
          >
            {mnemonic || starter}
          </button>
        )}
      </div>
    </div>
  );
}
