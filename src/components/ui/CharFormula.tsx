import type { Component } from "../../lib/types";

interface Props {
  pieces: Component[];
  onOpenEntity: (key: string) => void;
}

// One-line role-colored component formula: "= 讠 speech + 青 qīng".
// Sound pieces show their reading, meaning-ish pieces their gloss —
// the distilled "how it's built" reading of a character. Shared by
// LearnPage's per-char panels and the EntitySheet hero (v114).
export function CharFormula({ pieces, onOpenEntity }: Props) {
  if (pieces.length === 0) return null;
  return (
    <div className="learn-pieces">
      ={" "}
      {pieces.map((p, i) => (
        <span key={`${p.char}-${i}`}>
          {i > 0 && <span className="learn-piece-plus"> + </span>}
          <span
            className="learn-piece is-explorable"
            style={{ color: `var(--role-${p.type}, var(--text))` }}
            onClick={() => onOpenEntity(p.char)}
            role="button"
            tabIndex={0}
          >
            {p.char}
            {p.type === "sound" && p.pinyin
              ? ` ${p.pinyin}`
              : p.definition
                ? ` ${p.definition}`
                : ""}
          </span>
        </span>
      ))}
    </div>
  );
}
