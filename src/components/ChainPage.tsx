import { useEffect, useMemo, useRef, useState } from "react";
import { useDictCtx, useSavedCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import {
  chainBuildState,
  chainPool,
  nextChainStep,
  pickChainStart,
  type ChainStep,
} from "../lib/chain";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
}

// 词语接龙 (v117): grow a chain of the user's words, each starting
// with the previous word's last character.
//
// v121 (owner: "give a bunch of characters from which I can build the
// next word"): nothing is offered to recognize — no candidate words,
// no meanings. The link character is on the board and you build the
// continuation from a tray of loose characters. Any of your unused
// words starting with the link counts; a character that leads nowhere
// breaks the chain. Still a game — nothing is graded.
export function ChainPage({ onClose, onOpenEntity }: Props) {
  const { savedList } = useSavedCtx();
  const { findWord, ensureCached } = useDictCtx();
  const pool = useMemo(() => chainPool(savedList.map((s) => s.word)), [savedList]);

  const [chain, setChain] = useState<string[]>([]);
  const [step, setStep] = useState<ChainStep | null>(null);
  // Characters tapped so far for the word in progress (after the link).
  const [built, setBuilt] = useState("");
  const [usedTiles, setUsedTiles] = useState<number[]>([]);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [best, setBest] = useState(0);
  const chainEndRef = useRef<HTMLDivElement>(null);

  // Glosses are only shown for words already in the chain, so this is
  // a background nicety, not gating.
  useEffect(() => {
    void ensureCached(pool.slice(0, 60));
  }, [pool, ensureCached]);

  const startRun = () => {
    const start = pickChainStart(pool);
    setBuilt("");
    setUsedTiles([]);
    setWrongTile(null);
    setChain(start ? [start] : []);
    setStep(start ? nextChainStep(start, pool, new Set([start])) : null);
    if (start) autoSpeak(start);
  };

  const dealtRef = useRef(false);
  useEffect(() => {
    if (dealtRef.current || pool.length < 5) return;
    dealtRef.current = true;
    startRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);
  useEffect(() => () => stopSpeech(), []);

  useEffect(() => {
    chainEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [chain.length]);

  const score = Math.max(0, chain.length - 1);
  useEffect(() => {
    if (score > best) setBest(score);
  }, [score, best]);

  if (pool.length < 5 || (chain.length === 0 && !step)) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Chain" progress="" />
        <EmptyState
          variant="review"
          title="Not enough material yet."
          hint="接龙 needs a handful of multi-character words that share characters."
        />
      </div>
    );
  }

  const broken = wrongTile !== null;
  const deadEnd = !broken && step === null && chain.length > 0;
  const over = broken || deadEnd;

  const tapTile = (i: number) => {
    if (!step || over) return;
    const next = built + step.tray[i];
    const state = chainBuildState(step.link, next, step.answers);
    if (state === "dead") {
      setWrongTile(i);
      return;
    }
    if (state === "building") {
      setBuilt(next);
      setUsedTiles((prev) => [...prev, i]);
      return;
    }
    const word = step.link + next;
    const nextChain = [...chain, word];
    setChain(nextChain);
    setBuilt("");
    setUsedTiles([]);
    setStep(nextChainStep(word, pool, new Set(nextChain)));
    autoSpeak(word);
  };

  const clearBuild = () => {
    setBuilt("");
    setUsedTiles([]);
  };

  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag="Chain"
        progress={`${score} link${score === 1 ? "" : "s"}`}
      />
      <div className="chain-body">
        <div className="chain-row">
          {chain.map((w, i) => (
            <span key={`${w}-${i}`} className="chain-word-wrap">
              {i > 0 && <span className="chain-arrow">→</span>}
              <button
                type="button"
                className={`chain-word${i === chain.length - 1 ? " is-head" : ""}`}
                onClick={onOpenEntity ? () => onOpenEntity(w) : undefined}
              >
                {i === chain.length - 1 && !over ? (
                  <>
                    {[...w].slice(0, -1).join("")}
                    <span className="chain-link-char">{[...w].pop()}</span>
                  </>
                ) : (
                  w
                )}
              </button>
            </span>
          ))}
          <span ref={chainEndRef} />
        </div>

        {step && !over && (
          <>
            <div className="phonetic-tap-prompt">Build a word that starts with</div>
            <div className="chain-build">
              <span className="chain-build-link">{step.link}</span>
              {[...built].map((c, i) => (
                <span key={`${c}-${i}`} className="chain-build-char">
                  {c}
                </span>
              ))}
              {!built && <span className="chain-build-slot">＋</span>}
              {built && (
                <button type="button" className="chain-build-clear" onClick={clearBuild}>
                  ✕
                </button>
              )}
            </div>
            <div className="chain-tray">
              {step.tray.map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  type="button"
                  className={`forge-piece${usedTiles.includes(i) ? " is-consumed" : ""}${
                    wrongTile === i ? " is-wrong" : ""
                  }`}
                  onClick={() => tapTile(i)}
                  disabled={usedTiles.includes(i)}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        {over && (
          <div className="forge-end">
            <div className="forge-end-title">
              {deadEnd
                ? `Perfect chain — the pool ran dry at ${score}! 🐉`
                : `Chain broken at ${score}.`}
            </div>
            {broken && step && (
              <div className="chain-reveal">
                No word of yours starts with {step.link + built + step.tray[wrongTile!]}. It wanted{" "}
                <button
                  type="button"
                  className="chain-word"
                  onClick={onOpenEntity ? () => onOpenEntity(step.answers[0]) : undefined}
                >
                  {step.answers[0]}
                </button>{" "}
                {(findWord(step.answers[0])?.definitions ?? [])[0] ?? ""}
              </div>
            )}
            <div className="chain-best">Best this visit: {best}</div>
            <button type="button" className="review-btn review-btn-reveal" onClick={startRun}>
              New chain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
