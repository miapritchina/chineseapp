import { useRef } from "react";
import type { Char, Word } from "../lib/types";
import { Card, CharOnlyCard } from "./Card";

interface Props {
  saved: Set<string>;
  findWord: (key: string) => Word | null;
  chars: Record<string, Char>;
  onOpenWord: (word: string) => void;
  onOpenChar: (char: string) => void;
  onExport: () => void;
  onImport: (items: string[]) => Promise<{ added: number; total: number }>;
}

// Accepts the export shape {app, saved: [...]} OR a bare array of strings.
function parseExport(text: string): string[] | null {
  try {
    const json: unknown = JSON.parse(text);
    if (Array.isArray(json)) {
      return json.filter((x): x is string => typeof x === "string");
    }
    if (json && typeof json === "object" && Array.isArray((json as { saved?: unknown }).saved)) {
      const arr = (json as { saved: unknown[] }).saved;
      return arr.filter((x): x is string => typeof x === "string");
    }
    return null;
  } catch {
    return null;
  }
}

export function SavedShelf({ saved, findWord, chars, onOpenWord, onOpenChar, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isEmpty = saved.size === 0;

  const triggerImport = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      const text = await file.text();
      const items = parseExport(text);
      if (items === null) {
        alert("That doesn't look like a saved-words export file.");
        return;
      }
      if (items.length === 0) {
        alert("File contains no saved words.");
        return;
      }
      const { added, total } = await onImport(items);
      const skipped = total - added;
      const skippedNote = skipped > 0 ? ` (${skipped} already saved)` : "";
      alert(`Imported ${added} word${added === 1 ? "" : "s"}${skippedNote}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Import failed: ${message}`);
    }
  };

  return (
    <section className="shelf-section">
      <div className="shelf-header">
        <div className="shelf-title">Saved</div>
        <div className="shelf-actions">
          {!isEmpty && (
            <button
              className="shelf-action"
              type="button"
              title="Download your saved words as a JSON file"
              onClick={onExport}
            >
              Export ⤓
            </button>
          )}
          <button
            className="shelf-action"
            type="button"
            title="Import a saved-words JSON file"
            onClick={triggerImport}
          >
            Import ⤒
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleFile}
      />

      {isEmpty ? (
        <div className="shelf-empty">No saved words yet.</div>
      ) : (
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
      )}
    </section>
  );
}
