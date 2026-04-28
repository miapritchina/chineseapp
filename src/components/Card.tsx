import type { Word } from "../lib/types";

interface Props {
  word: Word;
  onOpen: (word: string) => void;
}

export function Card({ word, onOpen }: Props) {
  return (
    <button
      className="card"
      type="button"
      aria-label={`${word.simp} ${word.pinyin}`}
      onClick={() => onOpen(word.word)}
    >
      <div className="char">{word.simp}</div>
      <div className="pinyin">{word.pinyin}</div>
      <div className="gloss">{word.definitions?.[0] || ""}</div>
    </button>
  );
}

interface CharCardProps {
  charKey: string;
  pinyin: string;
  gloss: string;
  onOpen: (char: string) => void;
}

export function CharOnlyCard({ charKey, pinyin, gloss, onOpen }: CharCardProps) {
  return (
    <button
      className="card"
      type="button"
      aria-label={`${charKey} ${pinyin}`}
      onClick={() => onOpen(charKey)}
    >
      <div className="char">{charKey}</div>
      <div className="pinyin">{pinyin}</div>
      <div className="gloss">{gloss}</div>
    </button>
  );
}
