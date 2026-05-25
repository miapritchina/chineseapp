import { useEffect, useState } from "react";
import type { Char } from "../../lib/types";
import { buildStarterMnemonic, buildStarterWordMnemonic } from "../../lib/mnemonics";
import { useMnemonicsCtx } from "../../state/contexts";

// "💡 MAKE IT STICK" — editable mnemonic. Stores user-edited text via
// useMnemonicsCtx; falls back to a starter generated from the entity's
// pinyin/meaning. "Reset" clears the user override and shows the starter
// again.

interface Props {
  itemKey: string;
  isMultiCharWord: boolean;
  pinyin: string;
  defs: string[];
  charData: Char | undefined;
  // Multi-char word context (only used when isMultiCharWord is true).
  word: { word: string } | null | undefined;
  chars: Record<string, Char>;
}

export function MnemonicSection({
  itemKey,
  isMultiCharWord,
  pinyin,
  defs,
  charData,
  word,
  chars,
}: Props) {
  const { get: getMnemonic, save: saveMnemonic, clear: clearMnemonic } = useMnemonicsCtx();

  const starter =
    isMultiCharWord && word
      ? buildStarterWordMnemonic(word.word, pinyin, defs[0] ?? "", chars)
      : buildStarterMnemonic(itemKey, charData);

  const stored = getMnemonic(itemKey);
  const [mnemonic, setMnemonic] = useState<string>(() => stored?.text ?? starter);
  const [editedFlag, setEditedFlag] = useState<boolean>(() => !!stored?.edited);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const s = getMnemonic(itemKey);
    setMnemonic(s?.text ?? starter);
    setEditedFlag(!!s?.edited);
    setEditing(false);
    // Re-derive when the entity key changes (the EntitySheet reuses the
    // component instance as the user drills around). `starter` and
    // `getMnemonic` are referentially unstable; the effect intentionally
    // doesn't re-fire on those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const persist = (text: string) => {
    if (text === starter && !editedFlag) {
      clearMnemonic(itemKey);
      return;
    }
    saveMnemonic(itemKey, text);
    setEditedFlag(true);
  };

  const reset = () => {
    clearMnemonic(itemKey);
    setMnemonic(starter);
    setEditedFlag(false);
    setEditing(false);
  };

  return (
    <section className="sheet-section">
      <div className="sheet-section-head">
        <span className="sheet-section-name sheet-mnemonic-title">
          💡 MAKE IT STICK
          {editedFlag && <span className="mnemonic-saved-tag">your version</span>}
        </span>
        {editedFlag && (
          <button
            type="button"
            className="mnemonic-reset"
            onClick={reset}
            title="Reset to the auto-suggested mnemonic"
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
          placeholder="Write a story, image, or hook that makes this stick…"
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
    </section>
  );
}
