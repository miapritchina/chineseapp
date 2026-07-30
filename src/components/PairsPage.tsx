import { useEffect, useRef, useState } from "react";
import { useDictCtx } from "../state/contexts";
import { autoSpeak, stopSpeech } from "../lib/speech";
import { buildPairsBoard, tilesMatch, PAIRS_PER_BOARD, type PairTile } from "../lib/pairs";
import { resolveCrossRefs } from "../lib/gloss";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  // Candidate words, due-first (App builds it).
  words: string[];
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
}

const GLOSS_MAX = 40;

// Pairs board (v116): memory match, hanzi against meanings, material
// from the due queue so the exposure still counts for something —
// but nothing is graded.
export function PairsPage({ words, onClose, onOpenEntity }: Props) {
  const { findWord, ensureCached } = useDictCtx();
  const [board, setBoard] = useState<PairTile[] | null>(null);
  const [ready, setReady] = useState(false);
  const [faceUp, setFaceUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [moves, setMoves] = useState(0);
  const startRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState<number | null>(null);
  const flipTimer = useRef<number | null>(null);

  const glossOf = (w: string) => {
    const defs = resolveCrossRefs(findWord(w)?.definitions ?? [], findWord);
    const g = defs[0] ?? "";
    return g.length > GLOSS_MAX ? g.slice(0, GLOSS_MAX - 1) + "…" : g;
  };

  // Hydrate the pool, then deal a board from whatever resolved.
  useEffect(() => {
    let cancelled = false;
    void ensureCached(words.slice(0, 60)).then(() => {
      if (cancelled) return;
      setBoard((prev) => prev ?? buildPairsBoard(words.slice(0, 60), glossOf));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, ensureCached]);
  useEffect(() => () => stopSpeech(), []);

  const dealAgain = () => {
    setBoard(buildPairsBoard(words.slice(0, 60), glossOf));
    setFaceUp([]);
    setMatched(new Set());
    setMoves(0);
    setElapsed(null);
    startRef.current = Date.now();
  };

  if (board === null) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Pairs" progress="" />
        <EmptyState
          variant="review"
          title={ready ? "Not enough material." : "Dealing…"}
          hint={ready ? `Pairs needs ${PAIRS_PER_BOARD} words with dictionary meanings.` : ""}
        />
      </div>
    );
  }

  const done = matched.size === board.length;

  const tapTile = (t: PairTile) => {
    if (matched.has(t.id) || faceUp.includes(t.id) || faceUp.length >= 2) return;
    const next = [...faceUp, t.id];
    setFaceUp(next);
    if (next.length < 2) return;
    setMoves((n) => n + 1);
    const [a, b] = next.map((id) => board.find((x) => x.id === id)!);
    if (tilesMatch(a, b)) {
      setMatched((prev) => {
        const m = new Set(prev).add(a.id).add(b.id);
        if (m.size === board.length) setElapsed(Math.round((Date.now() - startRef.current) / 1000));
        return m;
      });
      setFaceUp([]);
      autoSpeak(a.word);
    } else {
      if (flipTimer.current) window.clearTimeout(flipTimer.current);
      flipTimer.current = window.setTimeout(() => setFaceUp([]), 750);
    }
  };

  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag="Pairs"
        progress={`${matched.size / 2} / ${PAIRS_PER_BOARD}`}
      />
      <div className="pairs-body">
        <div className="pairs-grid">
          {board.map((t) => {
            const up = faceUp.includes(t.id) || matched.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`pairs-tile${up ? " is-up" : ""}${matched.has(t.id) ? " is-matched" : ""}${
                  t.kind === "hanzi" ? " is-hanzi" : ""
                }`}
                onClick={() => tapTile(t)}
                aria-label={up ? t.text : "Face-down tile"}
              >
                {up ? t.text : "？"}
              </button>
            );
          })}
        </div>
        <div className="pairs-status">{moves} moves</div>
        {done && (
          <div className="forge-end">
            <div className="forge-end-title">
              🎉 All matched — {moves} moves · {elapsed}s
            </div>
            {onOpenEntity && (
              <div className="pairs-review-row">
                {[...new Set(board.map((t) => t.word))].map((w) => (
                  <button
                    key={w}
                    type="button"
                    className="sort-pill"
                    onClick={() => onOpenEntity(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="review-btn review-btn-reveal" onClick={dealAgain}>
              Deal again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
