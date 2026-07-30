import { useEffect, useMemo, useRef, useState } from "react";
import { useCharsCtx, useSavedCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { buildForgeRound, forgeCandidates, forgeMatch } from "../lib/forge";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
}

// Character forge (v116): the tray scatters components of characters
// the user knows; tapping a valid pair forges the character — glyph,
// reading, meaning, sound. A game, not a drill: nothing is graded.
export function ForgePage({ onClose, onOpenEntity }: Props) {
  const { chars } = useCharsCtx();
  const { savedList } = useSavedCtx();

  const candidates = useMemo(
    () =>
      forgeCandidates(
        savedList.map((s) => s.word),
        chars,
      ),
    [savedList, chars],
  );
  const [roundSeed, setRoundSeed] = useState(0);
  const round = useMemo(() => buildForgeRound(candidates), [candidates, roundSeed]);

  const [selected, setSelected] = useState<number | null>(null);
  const [consumed, setConsumed] = useState<Set<number>>(() => new Set());
  const [forged, setForged] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState<[number, number] | null>(null);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => () => stopSpeech(), []);

  const newRound = () => {
    setRoundSeed((n) => n + 1);
    setSelected(null);
    setConsumed(new Set());
    setForged([]);
    setMisses(0);
    setShake(null);
  };

  if (!round) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Forge" progress="" />
        <EmptyState
          variant="review"
          title="Not enough material yet."
          hint="Forge needs a few saved characters that split into two components."
        />
      </div>
    );
  }

  const forgedSet = new Set(forged);
  const done = forged.length === round.targets.length;

  const tapPiece = (i: number) => {
    if (consumed.has(i) || shake) return;
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (selected === null) {
      setSelected(i);
      return;
    }
    const target = forgeMatch(round.targets, forgedSet, round.pieces[selected], round.pieces[i]);
    if (target) {
      setConsumed((prev) => new Set(prev).add(selected).add(i));
      setForged((prev) => [...prev, target.char]);
      setSelected(null);
      autoSpeak(target.char);
    } else {
      setMisses((n) => n + 1);
      setShake([selected, i]);
      setSelected(null);
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShake(null), 450);
    }
  };

  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag="Forge"
        progress={`${forged.length} / ${round.targets.length}`}
      />
      <div className="forge-body">
        <div className="phonetic-tap-prompt">
          Tap two components that forge a character you know.
        </div>
        <div className="forge-tray">
          {round.pieces.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              className={`forge-piece${selected === i ? " is-selected" : ""}${
                consumed.has(i) ? " is-consumed" : ""
              }${shake && (shake[0] === i || shake[1] === i) ? " is-wrong" : ""}`}
              onClick={() => tapPiece(i)}
              disabled={consumed.has(i)}
            >
              {p}
            </button>
          ))}
        </div>
        {forged.length > 0 && (
          <div className="forge-done-row">
            {forged.map((c) => {
              const cd = chars?.[c];
              return (
                <button
                  key={c}
                  type="button"
                  className="forge-result is-explorable"
                  onClick={onOpenEntity ? () => onOpenEntity(c) : undefined}
                >
                  <span className="forge-result-hanzi">{c}</span>
                  <span className="forge-result-meta">
                    {cd?.pinyin ?? ""} {cd?.definitions?.[0] ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {done && (
          <div className="forge-end">
            <div className="forge-end-title">
              All forged!{" "}
              {misses === 0 ? "Flawless." : `${misses} miss${misses === 1 ? "" : "es"}.`}
            </div>
            <button type="button" className="review-btn review-btn-reveal" onClick={newRound}>
              New round
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
