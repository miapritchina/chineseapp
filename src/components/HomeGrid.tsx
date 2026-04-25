import { useState } from "react";
import type { Word } from "../lib/types";
import { Card } from "./Card";

const PAGE_SIZE = 60;

interface Props {
  words: Word[];
  onOpen: (word: string) => void;
}

export function HomeGrid({ words, onOpen }: Props) {
  const [page, setPage] = useState(1);
  const upTo = Math.min(page * PAGE_SIZE, words.length);

  return (
    <section className="grid-section">
      <div className="shelf-title">Most common words</div>
      <div className="grid">
        {words.slice(0, upTo).map((w) => (
          <Card key={w.word} word={w} onOpen={onOpen} />
        ))}
      </div>
      {upTo < words.length && (
        <button className="load-more" type="button" onClick={() => setPage((p) => p + 1)}>
          Load more
        </button>
      )}
    </section>
  );
}
