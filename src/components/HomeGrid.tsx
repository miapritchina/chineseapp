import type { Word } from "../lib/types";
import { Card } from "./Card";

interface Props {
  words: Word[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (word: string) => void;
}

export function HomeGrid({ words, hasMore, loadingMore, onLoadMore, onOpen }: Props) {
  return (
    <section className="grid-section">
      <div className="shelf-title">Most common words</div>
      <div className="grid">
        {words.map((w) => (
          <Card key={w.word} word={w} onOpen={onOpen} />
        ))}
      </div>
      {hasMore && (
        <button
          className="load-more"
          type="button"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
