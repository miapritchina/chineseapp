import type { ReactNode } from "react";
import type { Word } from "../lib/types";
import { detectPos, POS_COLOR, POS_LABEL } from "../lib/pos";
import { hanziScaleStyle } from "../lib/hanzi";
import { StatusButton } from "./StatusButton";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";

// Unified character/word tile (redesign §0). One component, five sizes,
// consistent visual DNA: pinyin (top) → hanzi (center) → meaning + POS
// (bottom), status ★ in the corner at md+. Resolves its own data from
// context given an identity, so call sites pass an id, not pre-resolved
// props.
//
// Progressive disclosure by size (overridable):
//   tiny  hanzi (+pinyin)              — graph nodes, drill picks, chips
//   sm    + pinyin + meaning + POS     — bank chips, cluster/disambig cells
//   md    + status corner              — shelf cards, the workhorse
//   lg    (handled in a later stage — component breakdown)
//   hero  (handled in a later stage — review focal glyph)
//
// `breakdown` not yet implemented (lg); `trailing` is an escape hatch for
// per-site extras (e.g. the component chip's "N words" count).

export type EntitySize = "tiny" | "sm" | "md" | "lg" | "hero";

interface Props {
  word?: Word | null;
  itemKey?: string;
  size: EntitySize;
  onTap?: (key: string) => void;
  showStatus?: boolean;
  showPinyin?: boolean;
  showMeaning?: boolean;
  roleColor?: string;
  trailing?: ReactNode;
  className?: string;
  ariaLabel?: string;
  // Override the hanzi-slot rendering. Lets callers embed a richer
  // hanzi treatment (e.g. <HanziGlyph mode="animate"> for the
  // EntitySheet header) inside Entity's pinyin → hanzi → meaning DNA
  // without giving up the surrounding layout. The slot replaces the
  // default key-as-text content of the `.entity-hanzi` wrapper, so size
  // tokens still apply if the child opts in.
  hanziSlot?: ReactNode;
}

export function Entity({
  word,
  itemKey,
  size,
  onTap,
  showStatus,
  showPinyin,
  showMeaning,
  roleColor,
  trailing,
  className,
  ariaLabel,
  hanziSlot,
}: Props) {
  const { getStatus, setStatus } = useSavedCtx();
  const { findWord } = useDictCtx();
  const { chars } = useCharsCtx();

  const key = word?.word ?? itemKey ?? "";
  const resolvedWord = word ?? findWord(key);
  const charData = chars[key];

  const pinyin = resolvedWord?.pinyin ?? charData?.pinyin ?? "";
  const defs =
    resolvedWord?.definitions && resolvedWord.definitions.length > 0
      ? resolvedWord.definitions
      : (charData?.definitions ?? []);
  const meaning = defs[0] ?? "";

  // Defaults follow the size tier; explicit props override.
  const wantPinyin = showPinyin ?? size !== "tiny";
  const wantMeaning = showMeaning ?? (size === "sm" || size === "md" || size === "lg");
  const wantStatus = showStatus ?? (size === "md" || size === "lg");

  const pos =
    wantMeaning && defs.length > 0 ? detectPos({ word: key, definitions: defs } as Word) : null;

  const style = {
    ...(size !== "md" ? hanziScaleStyle(key) : {}),
    ...(roleColor ? ({ ["--entity-role"]: roleColor } as Record<string, string>) : {}),
  };

  const interactive = !!onTap;
  const handleTap = () => onTap?.(key);

  return (
    <div
      className={`entity entity-${size}${className ? ` ${className}` : ""}`}
      style={style}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel ?? `${key} ${pinyin}`.trim()}
      onClick={interactive ? handleTap : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTap();
              }
            }
          : undefined
      }
    >
      {wantStatus && (
        <div className="entity-status" onClick={(e) => e.stopPropagation()}>
          <StatusButton status={getStatus(key)} onChange={(next) => setStatus(key, next)} />
        </div>
      )}
      <div className="entity-primary">
        {wantPinyin && pinyin && <div className="entity-pinyin">{pinyin}</div>}
        <div className="entity-hanzi">{hanziSlot ?? key}</div>
      </div>
      {wantMeaning && meaning && (
        <div className="entity-meaning">
          {meaning}
          {pos && (
            <span className="entity-pos" style={{ color: POS_COLOR[pos] }}>
              {" "}
              {POS_LABEL[pos]}
            </span>
          )}
        </div>
      )}
      {trailing}
    </div>
  );
}
