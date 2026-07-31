import { useEffect, useMemo, useRef, useState } from "react";
import { useDictCtx, useSavedCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { anySmushLeft, buildWordForgeRound, forgeWordPool, smush } from "../lib/forge";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
}

// Word forge (v118, Smush-style — replaced the component forge): the
// tray scatters characters from the user's words; tap two to smush
// them into any saved word. Round ends when nothing combines; an
// empty tray is a perfect clear. A game — nothing is graded.
export function ForgePage({ onClose, onOpenEntity }: Props) {
  const { findWord } = useDictCtx();
  const { savedList } = useSavedCtx();

  const pool = useMemo(() => forgeWordPool(savedList.map((s) => s.word)), [savedList]);
  const [roundSeed, setRoundSeed] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo(() => buildWordForgeRound(pool), [pool, roundSeed]);

  const [selected, setSelected] = useState<number | null>(null);
  const [consumed, setConsumed] = useState<Set<number>>(() => new Set());
  const [formed, setFormed] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [shake, setShake] = useState<[number, number] | null>(null);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => () => stopSpeech(), []);

  const newRound = () => {
    setRoundSeed((n) => n + 1);
    setSelected(null);
    setConsumed(new Set());
    setFormed([]);
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
          hint="Forge needs a handful of saved two-character words."
        />
      </div>
    );
  }

  const remaining = round.tiles.filter((_, i) => !consumed.has(i));
  const done = remaining.length === 0 || !anySmushLeft(remaining, round.wordSet);
  const perfect = remaining.length === 0;

  const tapTile = (i: number) => {
    if (consumed.has(i) || shake || done) return;
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (selected === null) {
      setSelected(i);
      return;
    }
    const word = smush(round.tiles[selected], round.tiles[i], round.wordSet);
    if (word) {
      setConsumed((prev) => new Set(prev).add(selected).add(i));
      setFormed((prev) => [...prev, word]);
      setSelected(null);
      autoSpeak(word);
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
        progress={`${formed.length} word${formed.length === 1 ? "" : "s"}`}
      />
      <div className="forge-body">
        <div className="phonetic-tap-prompt">Smush two characters into a word you know.</div>
        <div className="forge-tray">
          {round.tiles.map((c, i) => (
            <button
              key={`${c}-${i}`}
              type="button"
              className={`forge-piece${selected === i ? " is-selected" : ""}${
                consumed.has(i) ? " is-consumed" : ""
              }${shake && (shake[0] === i || shake[1] === i) ? " is-wrong" : ""}`}
              onClick={() => tapTile(i)}
              disabled={consumed.has(i)}
            >
              {c}
            </button>
          ))}
        </div>
        {formed.length > 0 && (
          <div className="forge-done-row">
            {formed.map((w, i) => {
              const row = findWord(w);
              return (
                <button
                  key={`${w}-${i}`}
                  type="button"
                  className="forge-result is-explorable"
                  onClick={onOpenEntity ? () => onOpenEntity(w) : undefined}
                >
                  <span className="forge-result-hanzi">{w}</span>
                  <span className="forge-result-meta">
                    {row?.pinyin ?? ""} {row?.definitions?.[0] ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {done && (
          <div className="forge-end">
            <div className="forge-end-title">
              {perfect
                ? `Perfect clear — ${formed.length} words! ✨`
                : `Nothing left to smush — ${formed.length} word${formed.length === 1 ? "" : "s"}, ${remaining.length} tiles stranded.`}
            </div>
            {misses > 0 && (
              <div className="chain-best">
                {misses} miss{misses === 1 ? "" : "es"}
              </div>
            )}
            <button type="button" className="review-btn review-btn-reveal" onClick={newRound}>
              New round
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
