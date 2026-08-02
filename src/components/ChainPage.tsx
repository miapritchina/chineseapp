import { useEffect, useMemo, useRef, useState } from "react";
import { useDictCtx, useSavedCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { chainPool, nextChainStep, pickChainStart, type ChainStep } from "../lib/chain";
import { resolveCrossRefs } from "../lib/gloss";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
}

const GLOSS_MAX = 60;

// 词语接龙 (v117): grow a chain of the user's words, each starting
// with the previous word's last character.
//
// v120 (owner: "I can choose the word with the correct start
// character even if I have not the slightest idea what it is"): the
// options are MEANINGS, not hanzi. You have to recall which of your
// words begins with the link character AND means that — the hanzi
// only appears once you're right. Still a game: nothing is graded.
export function ChainPage({ onClose, onOpenEntity }: Props) {
  const { savedList } = useSavedCtx();
  const { findWord, ensureCached } = useDictCtx();
  const saved = useMemo(() => chainPool(savedList.map((s) => s.word)), [savedList]);

  const glossOf = (w: string) => {
    const defs = resolveCrossRefs(findWord(w)?.definitions ?? [], findWord);
    const g = defs[0] ?? "";
    return g.length > GLOSS_MAX ? g.slice(0, GLOSS_MAX - 1) + "…" : g;
  };

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void ensureCached(saved).then(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [saved, ensureCached]);

  // Only words whose meaning we can show can be played — an option
  // with no gloss would be a blank tile.
  const pool = useMemo(
    () => (hydrated ? saved.filter((w) => glossOf(w)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, hydrated, findWord],
  );

  const [chain, setChain] = useState<string[]>([]);
  const [step, setStep] = useState<ChainStep | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  const [best, setBest] = useState(0);
  const chainEndRef = useRef<HTMLDivElement>(null);

  const startRun = (from: string[] = pool) => {
    const start = pickChainStart(from);
    setWrongPick(null);
    setChain(start ? [start] : []);
    setStep(start ? nextChainStep(start, from, new Set([start])) : null);
    if (start) autoSpeak(start);
  };

  // Deal once the dictionary has landed.
  const dealtRef = useRef(false);
  useEffect(() => {
    if (dealtRef.current || pool.length < 5) return;
    dealtRef.current = true;
    startRun(pool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);
  useEffect(() => () => stopSpeech(), []);

  // Keep the newest link visible as the chain grows.
  useEffect(() => {
    chainEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [chain.length]);

  const score = Math.max(0, chain.length - 1);
  useEffect(() => {
    if (score > best) setBest(score);
  }, [score, best]);

  if (!hydrated) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Chain" progress="" />
        <EmptyState variant="review" title="Dealing…" hint="" />
      </div>
    );
  }

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
  const answer = step ? (step.options.find((w) => w.startsWith(step.link)) ?? null) : null;
  // A distractor that happens to share the answer's gloss would make a
  // "wrong" tap look right — drop those.
  const options = step
    ? step.options.filter((w) => w === answer || glossOf(w) !== glossOf(answer ?? ""))
    : [];

  const pick = (w: string) => {
    if (!step || over) return;
    if (w === answer) {
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
              Which of your words starts with <span className="chain-link-char">{step.link}</span>{" "}
              and means…
            </div>
            <div className="chain-options">
              {options.map((w) => (
                <button key={w} type="button" className="chain-option" onClick={() => pick(w)}>
                  {glossOf(w)}
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
            {broken && answer && (
              <div className="chain-reveal">
                That was <b>{wrongPick}</b> — the chain wanted{" "}
                <button
                  type="button"
                  className="chain-word"
                  onClick={onOpenEntity ? () => onOpenEntity(answer) : undefined}
                >
                  {answer}
                </button>{" "}
                {glossOf(answer)}.
              </div>
            )}
            <div className="chain-best">Best this visit: {best}</div>
            <button
              type="button"
              className="review-btn review-btn-reveal"
              onClick={() => startRun(pool)}
            >
              New chain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
