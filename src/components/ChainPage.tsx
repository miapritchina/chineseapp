import { useEffect, useMemo, useRef, useState } from "react";
import { useSavedCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { chainPool, nextChainStep, pickChainStart, type ChainStep } from "../lib/chain";
import { hanziScaleStyle } from "../lib/hanzi";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
}

// 词语接龙 (v117): grow a chain of the user's words, each starting
// with the previous word's last character. One wrong tap breaks the
// chain; running the pool dry is a perfect chain. A game — no grades.
export function ChainPage({ onClose, onOpenEntity }: Props) {
  const { savedList } = useSavedCtx();
  const pool = useMemo(() => chainPool(savedList.map((s) => s.word)), [savedList]);

  const [chain, setChain] = useState<string[]>([]);
  const [step, setStep] = useState<ChainStep | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [best, setBest] = useState(0);
  const chainEndRef = useRef<HTMLDivElement>(null);

  const startRun = () => {
    const start = pickChainStart(pool);
    setWrongPick(null);
    if (!start) {
      setChain([]);
      setStep(null);
      return;
    }
    setChain([start]);
    setStep(nextChainStep(start, pool, new Set([start])));
    autoSpeak(start);
  };

  // Deal the first run on mount.
  useEffect(() => {
    startRun();
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest link visible as the chain grows.
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

  const broken = wrongPick !== null;
  const deadEnd = !broken && step === null && chain.length > 0;
  const over = broken || deadEnd;

  const pick = (w: string) => {
    if (!step || over) return;
    if (w.startsWith(step.link)) {
      const nextChain = [...chain, w];
      setChain(nextChain);
      setStep(nextChainStep(w, pool, new Set(nextChain)));
      autoSpeak(w);
    } else {
      setWrongPick(w);
    }
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
            <div className="phonetic-tap-prompt">
              Next word starts with <span className="chain-link-char">{step.link}</span>
            </div>
            <div className="chain-options">
              {step.options.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="chain-option"
                  style={hanziScaleStyle(w)}
                  onClick={() => pick(w)}
                >
                  {w}
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
                {wrongPick} doesn&apos;t start with {step.link} — the chain wanted{" "}
                <b>{step.options.find((w) => w.startsWith(step.link))}</b>.
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
