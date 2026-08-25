import { useEffect, useState } from "react";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { buildFamilySweep, familySweepScore } from "../lib/drillGen";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { Entity } from "./Entity";

interface Props {
  component: PhoneticComponent;
  pool: PhoneticComponent[];
  charExists: (char: string) => boolean;
  // 0–1 performance score: hits / (members + wrong taps), so a near-
  // miss earns partial credit instead of a full lapse (rebalance
  // stage 3).
  onScore: (score: number) => void;
  // Open the EntitySheet for a tapped character (post-confirm).
  onOpenEntity?: (key: string) => void;
}

// Drill 4: spot the component — tap every character built with it;
// decoys come from other components' families.
export function FamilySweepCard({ component, pool, charExists, onScore, onOpenEntity }: Props) {
  const [task] = useState(() => buildFamilySweep(component, pool, charExists));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    autoSpeak(component.char);
    return () => stopSpeech();
  }, [component.char]);

  if (!task) {
    return (
      <div className="phonetic-tap">
        <div className="phonetic-tap-prompt">
          Not enough family data for {component.char}. Tap Skip.
        </div>
      </div>
    );
  }

  const memberSet = new Set(task.members);
  const exact =
    confirmed && selected.size === memberSet.size && [...selected].every((c) => memberSet.has(c));

  const toggle = (c: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };

  const advance = () => {
    if (!confirmed) return;
    onScore(familySweepScore(task.members, selected));
  };

  return (
    <div
      className={`phonetic-tap${confirmed ? " is-tappable" : ""}`}
      onClick={confirmed ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Tap all that contain:</div>
        <div className="sweep-hero">
          <span
            className={`sweep-hero-glyph${onOpenEntity ? " is-explorable" : ""}`}
            onClick={
              onOpenEntity
                ? (e) => {
                    e.stopPropagation();
                    onOpenEntity(component.char);
                  }
                : undefined
            }
          >
            {component.char}
          </span>
          {component.pinyin && <span className="sweep-hero-pinyin">{component.pinyin}</span>}
        </div>
        <div className="phonetic-tap-row sweep-grid">
          {task.grid.map((c) => {
            const isMember = memberSet.has(c);
            const isSelected = selected.has(c);
            const flash = !confirmed
              ? isSelected
                ? "is-selected"
                : ""
              : isSelected && isMember
                ? "is-correct"
                : isSelected && !isMember
                  ? "is-wrong"
                  : isMember
                    ? "is-reveal"
                    : "";
            return (
              <Entity
                key={c}
                itemKey={c}
                size="tiny"
                showPinyin={confirmed && isMember}
                showMeaning={false}
                ariaLabel={c}
                className={`phonetic-tap-pick ${flash}`.trim()}
                // Before confirming a tap toggles the selection;
                // afterwards it opens the character's sheet.
                onTap={
                  !confirmed ? () => toggle(c) : onOpenEntity ? () => onOpenEntity(c) : undefined
                }
              />
            );
          })}
        </div>
        {!confirmed ? (
          <button
            type="button"
            className="review-btn review-btn-reveal sweep-confirm"
            disabled={selected.size === 0}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmed(true);
            }}
          >
            Check
          </button>
        ) : (
          <>
            <div className={`phonetic-tap-feedback ${exact ? "" : "is-wrong"}`.trim()}>
              {exact
                ? "All of them — nice."
                : "Green = right, red = not family, outlined = missed."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
