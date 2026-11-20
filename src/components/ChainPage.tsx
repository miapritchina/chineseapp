import { useEffect, useMemo, useRef, useState } from "react";
import { useDictCtx, useSavedCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import {
  CHAIN_LIVES,
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

// 词语接龙 (v117): grow a chain of the user's words, each linked by
// a character of the previous word.
//
// v121 (owner: "give a bunch of characters from which I can build the
// next word"): nothing is offered to recognize — no candidate words,
// no meanings. The link character is on the board and you build the
// continuation from a tray of loose characters. Any of your unused
// words starting with the link counts; a character that leads nowhere
// breaks the chain. Still a game — nothing is graded.
//
// v156: any unused word CONTAINING the link counts, in any position —
// the link is a highlighted tray tile and you build the whole word.
// v157: the next link is the word's new character, not its last one.
// v161: three lives — a wrong tile costs one and resets the word.
export function ChainPage({ onClose, onOpenEntity }: Props) {
  const { savedList } = useSavedCtx();
  const { findWord, ensureCached } = useDictCtx();
  const pool = useMemo(() => chainPool(savedList.map((s) => s.word)), [savedList]);

  const [chain, setChain] = useState<string[]>([]);
  const [step, setStep] = useState<ChainStep | null>(null);
  // Characters tapped so far for the word in progress.
  const [built, setBuilt] = useState("");
  const [usedTiles, setUsedTiles] = useState<number[]>([]);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [lives, setLives] = useState(CHAIN_LIVES);
  // What the last wrong tap spelled — shown under the tray, and in the
  // reveal once the final life goes.
  const [missed, setMissed] = useState<string | null>(null);
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
    setLives(CHAIN_LIVES);
    setMissed(null);
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

  const broken = lives === 0;
  const deadEnd = !broken && step === null && chain.length > 0;
  const over = broken || deadEnd;

  const tapTile = (i: number) => {
    if (!step || over) return;
    const next = built + step.tray[i];
    const state = chainBuildState(next, step.answers);
    if (state === "dead") {
      setWrongTile(i);
      setMissed(next);
      setLives((l) => l - 1);
      setBuilt("");
      setUsedTiles([]);
      return;
    }
    setWrongTile(null);
    if (state === "building") {
      setBuilt(next);
      setUsedTiles((prev) => [...prev, i]);
      return;
    }
    const word = next;
    const nextChain = [...chain, word];
    setChain(nextChain);
    setBuilt("");
    setUsedTiles([]);
    setMissed(null);
    setStep(nextChainStep(word, pool, new Set(nextChain), Math.random, step.link));
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
        progress={`${score} link${score === 1 ? "" : "s"} · ${"♥".repeat(lives)}${"♡".repeat(
          CHAIN_LIVES - lives,
        )}`}
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
                {i === chain.length - 1 && step && !over
                  ? [...w].map((c, j) =>
                      c === step.link ? (
                        <span key={j} className="chain-link-char">
                          {c}
                        </span>
                      ) : (
                        c
                      ),
                    )
                  : w}
              </button>
            </span>
          ))}
          <span ref={chainEndRef} />
        </div>

        {step && !over && (
          <>
            <div className="phonetic-tap-prompt">Build a word that contains {step.link}</div>
            <div className="chain-build">
              {[...built].map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className={c === step.link ? "chain-build-link" : "chain-build-char"}
                >
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
                  className={`forge-piece${c === step.link ? " chain-tile-link" : ""}${
                    usedTiles.includes(i) ? " is-consumed" : ""
                  }${wrongTile === i ? " is-wrong" : ""}`}
                  onAnimationEnd={() => setWrongTile(null)}
                  onClick={() => tapTile(i)}
                  disabled={usedTiles.includes(i)}
                >
                  {c}
                </button>
              ))}
            </div>
            {missed && (
              <div className="chain-miss">
                No word of yours with {step.link} starts with {missed} — {lives}{" "}
                {lives === 1 ? "life" : "lives"} left
              </div>
            )}
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
                No word of yours with {step.link} starts with {missed}. It wanted{" "}
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
