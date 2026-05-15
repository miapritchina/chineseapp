import type { Word } from "../lib/types";
import { StatusButton } from "./StatusButton";
import { hanziScaleStyle } from "../lib/hanzi";
import { useSavedCtx } from "../state/contexts";

interface Props {
  word: Word;
  onOpen: (word: string) => void;
}

export function Card({ word, onOpen }: Props) {
  const { getStatus, setStatus } = useSavedCtx();
  const status = getStatus(word.word);
  return (
    <div
      className="card"
      style={hanziScaleStyle(word.simp)}
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
      <div className="card-status-corner" onClick={(e) => e.stopPropagation()}>
        <StatusButton status={status} onChange={(next) => setStatus(word.word, next)} />
      </div>
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
}

export function CharOnlyCard({ charKey, pinyin, gloss, onOpen }: CharCardProps) {
  const { getStatus, setStatus } = useSavedCtx();
  const status = getStatus(charKey);
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
      <div className="card-status-corner" onClick={(e) => e.stopPropagation()}>
        <StatusButton status={status} onChange={(next) => setStatus(charKey, next)} />
      </div>
      <div className="pinyin">{pinyin}</div>
      <div className="char">{charKey}</div>
      <div className="gloss">{gloss}</div>
    </div>
  );
}
