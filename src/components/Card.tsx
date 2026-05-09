import type { Word } from "../lib/types";
import type { Status } from "../hooks/useSaved";
import { StatusButton } from "./StatusButton";

interface Props {
  word: Word;
  onOpen: (word: string) => void;
  // Optional — when present, a small StatusButton overlays the
  // top-right corner so the user can change tier without opening the
  // full modal. Stops propagation on click.
  getStatus?: (key: string) => Status | null;
  setStatus?: (key: string, next: Status | null) => void;
}

export function Card({ word, onOpen, getStatus, setStatus }: Props) {
  const status = getStatus ? getStatus(word.word) : undefined;
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      aria-label={`${word.simp} ${word.pinyin}`}
      onClick={() => onOpen(word.word)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(word.word);
        }
      }}
    >
      {getStatus && setStatus && (
        <div
          className="card-status-corner"
          onClick={(e) => e.stopPropagation()}
        >
          <StatusButton
            status={status ?? null}
            onChange={(next) => setStatus(word.word, next)}
          />
        </div>
      )}
      <div className="pinyin">{word.pinyin}</div>
      <div className="char">{word.simp}</div>
      <div className="gloss">{word.definitions?.[0] || ""}</div>
    </div>
  );
}

interface CharCardProps {
  charKey: string;
  pinyin: string;
  gloss: string;
  onOpen: (char: string) => void;
  getStatus?: (key: string) => Status | null;
  setStatus?: (key: string, next: Status | null) => void;
}

export function CharOnlyCard({
  charKey,
  pinyin,
  gloss,
  onOpen,
  getStatus,
  setStatus,
}: CharCardProps) {
  const status = getStatus ? getStatus(charKey) : undefined;
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      aria-label={`${charKey} ${pinyin}`}
      onClick={() => onOpen(charKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(charKey);
        }
      }}
    >
      {getStatus && setStatus && (
        <div
          className="card-status-corner"
          onClick={(e) => e.stopPropagation()}
        >
          <StatusButton
            status={status ?? null}
            onChange={(next) => setStatus(charKey, next)}
          />
        </div>
      )}
      <div className="pinyin">{pinyin}</div>
      <div className="char">{charKey}</div>
      <div className="gloss">{gloss}</div>
    </div>
  );
}
