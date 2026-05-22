import { useMemo } from "react";
import type { Char } from "../lib/types";
import { componentFrequencies } from "../lib/componentSearch";
import { Entity } from "./Entity";

interface Props {
  savedWords: string[];
  chars: Record<string, Char>;
  onPick: (char: string) => void;
}

// Shown in the home view when search mode is "By component" and the input
// is empty. Surfaces every Han character that appears in the recursive
// component closure of the user's saved words, ranked by how many of those
// words it shows up in. Tap a chip to fill it into the search input.
export function ComponentTable({ savedWords, chars, onPick }: Props) {
  const sorted = useMemo(() => {
    const freq = componentFrequencies(savedWords, chars);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([c, count]) => ({ c, count, pinyin: chars[c]?.pinyin || "" }));
  }, [savedWords, chars]);

  if (sorted.length === 0) {
    return (
      <div className="empty-state">No component data yet — save a few words and come back.</div>
    );
  }

  return (
    <main className="home" aria-label="Components in your saved words">
      <div className="component-table-header">
        <div className="component-table-title">Components in your words</div>
        <div className="component-table-hint">Tap to find every saved word containing it</div>
      </div>
      <div className="component-table">
        {sorted.map(({ c, count }) => (
          <Entity
            key={c}
            itemKey={c}
            size="tiny"
            showPinyin
            onTap={onPick}
            className="component-chip"
            ariaLabel={`${c} — in ${count} saved word${count === 1 ? "" : "s"}`}
            trailing={<span className="component-chip-count">{count}</span>}
          />
        ))}
      </div>
    </main>
  );
}
