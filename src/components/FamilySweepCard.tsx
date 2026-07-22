import { useEffect, useState } from "react";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";
import { buildFamilySweep } from "../lib/drillGen";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { Entity } from "./Entity";

interface Props {
  component: PhoneticComponent;
  pool: PhoneticComponent[];
  charExists: (char: string) => boolean;
  onGrade: (rating: RatingName) => void;
}

// Drill 4: spot the component — tap every character built with it;
// decoys come from other components' families. Exact set → Good,
// anything else → Again.
export function FamilySweepCard({ component, pool, charExists, onGrade }: Props) {
  const [task] = useState(() => buildFamilySweep(component, pool, charExists));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    speak(component.char);
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
    onGrade(exact ? "Good" : "Again");
  };

  return (
    <div
      className={`phonetic-tap${confirmed ? " is-tappable" : ""}`}
      onClick={confirmed ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">
          Tap every character that contains {component.char}
          {component.pinyin ? ` (${component.pinyin})` : ""}
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
                onTap={!confirmed ? () => toggle(c) : undefined}
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
            <div className="drill-tap-hint">Tap anywhere to continue →</div>
          </>
        )}
      </div>
    </div>
  );
}
