import type { Char, Word } from "../lib/types";
import { Card, CharOnlyCard } from "./Card";

interface Props {
  saved: Set<string>;
  findWord: (key: string) => Word | null;
  chars: Record<string, Char>;
  onOpenWord: (word: string) => void;
  onOpenChar: (char: string) => void;
  onExport: () => void;
}

export function SavedShelf({ saved, findWord, chars, onOpenWord, onOpenChar, onExport }: Props) {
  if (saved.size === 0) return null;

  return (
    <section className="shelf-section">
      <div className="shelf-header">
        <div className="shelf-title">Saved</div>
        <button
          className="shelf-action"
          type="button"
          title="Download your saved words as a JSON file"
          onClick={onExport}
        >
          Export ⤓
        </button>
      </div>
      <div className="shelf">
        {[...saved].map((key) => {
          const w = findWord(key);
          if (w) return <Card key={key} word={w} onOpen={onOpenWord} />;
          const c = chars[key];
          if (c) {
            return (
              <CharOnlyCard
                key={key}
                charKey={key}
                pinyin={c.pinyin || ""}
                gloss={c.definitions?.[0] || ""}
                onOpen={onOpenChar}
              />
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}
