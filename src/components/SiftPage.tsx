import { useEffect, useRef, useState } from "react";
import { useCharsCtx, useDictCtx } from "../state/contexts";
import { autoSpeak, speak, stopSpeech } from "../lib/speech";
import { hanziScaleStyle } from "../lib/hanzi";
import { useResolvedDefs } from "../hooks/useResolvedDefs";
import { DrillShell } from "./ui/DrillShell";
import { EmptyState } from "./ui/EmptyState";
import { PageHeader } from "./ui/PageHeader";
import { LearnCard } from "./LearnCard";

interface Props {
  // Words with something due today, strongest-first (App builds it).
  words: string[];
  onClose: () => void;
  // Swipe right: "I know this" — the parent grades Good on every due
  // facet except production (a recognition self-report can't clear a
  // writing card), clearing the word from today's other workouts.
  onKnow: (word: string) => void;
  // Swipe left: keep for practice — hidden from Sift until tomorrow
  // (persisted by the parent). A left-swipe also opens the word's
  // lesson (v125, owner request): "I don't know this" is exactly the
  // moment to teach it.
  onKeep: (word: string) => void;
  // Finished the lesson (v126): the parent credits the exposure and
  // snoozes the word to tomorrow — having just studied it, re-testing
  // minutes later would measure nothing.
  onLessonDone?: (word: string) => void;
  onOpenEntity?: (key: string) => void;
  // Open the full d3 decomposition tree for a character (lesson view).
  onOpenTree?: (char: string) => void;
  // Flow mode (v114): called when the deck is exhausted, instead of
  // showing the end state — the parent advances to the next stage.
  onComplete?: () => void;
}

// Tinder-style triage (v113, owner request): the drills backlog holds
// 1000+ words, many already well-known — Sift is the fast pass that
// clears those and leaves the drills for the words that need work.
// Everything is visible up front (word + pinyin + meaning): this is a
// self-judgement, not a test.
export function SiftPage({
  words,
  onClose,
  onKnow,
  onKeep,
  onLessonDone,
  onOpenEntity,
  onOpenTree,
  onComplete,
}: Props) {
  const { chars } = useCharsCtx();
  const { findWord } = useDictCtx();
  const [index, setIndex] = useState(0);
  // A left-swiped word's lesson, shown before the next sift card.
  const [lesson, setLesson] = useState<string | null>(null);
  // Brief exit-direction flash so a swipe feels acknowledged.
  const [flash, setFlash] = useState<"know" | "keep" | null>(null);
  const decidedRef = useRef(false);

  const current = words[index];

  useEffect(() => {
    if (current && !lesson) autoSpeak(current);
  }, [current, lesson]);
  useEffect(() => () => stopSpeech(), []);

  useEffect(() => {
    if (!current && !lesson && onComplete) onComplete();
  }, [current, lesson, onComplete]);

  const word = current ? findWord(current) : null;
  const cd = current ? chars?.[current] : undefined;
  const pinyin = word?.pinyin ?? cd?.pinyin ?? "";
  const defs = useResolvedDefs(word?.definitions ?? cd?.definitions ?? []);
  const gloss = defs.slice(0, 3).join("; ");

  const decide = (verdict: "know" | "keep") => {
    if (!current || decidedRef.current) return;
    decidedRef.current = true;
    stopSpeech();
    const w = current;
    if (verdict === "know") onKnow(w);
    else onKeep(w);
    setFlash(verdict);
    window.setTimeout(() => {
      decidedRef.current = false;
      setFlash(null);
      if (verdict === "keep") setLesson(w);
      setIndex((i) => i + 1);
    }, 160);
  };

  // Swipe right = know, left = keep. Same thresholds as the
  // recognition card's swipe-to-grade.
  const SWIPE_MIN = 60;
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    decide(dx > 0 ? "know" : "keep");
  };

  // The lesson interlude for a just-left-swiped word — same card Learn
  // mode uses. Rendered before the end state so the deck's last word
  // still gets its lesson.
  if (lesson) {
    return (
      <DrillShell
        tag="Learn"
        onClose={onClose}
        progressIndex={Math.min(index + 1, words.length)}
        total={words.length}
        onSkip={() => setLesson(null)}
      >
        <LearnCard
          word={lesson}
          continueLabel={current ? "Got it · keep sifting" : "Got it · finish"}
          onContinue={() => {
            onLessonDone?.(lesson);
            setLesson(null);
          }}
          onOpenEntity={(key) => onOpenEntity?.(key)}
          onOpenTree={onOpenTree}
        />
      </DrillShell>
    );
  }

  if (!current) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} tag="Sift" progress="" />
        <EmptyState
          variant="review"
          title="Sifted through."
          hint="Right-swiped words are done for today everywhere except Writing; left-swiped ones stay in the drills."
        />
      </div>
    );
  }

  return (
    <DrillShell
      tag="Sift"
      onClose={onClose}
      progressIndex={index + 1}
      total={words.length}
      onSkip={() => setIndex((i) => i + 1)}
    >
      <div
        className={`sift-card${flash ? ` is-${flash}` : ""}`}
        key={current}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="phonetic-tap-prompt">Swipe → know it · ← practice</div>
        <span
          className={`sift-hanzi${onOpenEntity ? " is-explorable" : ""}`}
          style={hanziScaleStyle(current)}
          onClick={onOpenEntity ? () => onOpenEntity(current) : undefined}
          role="button"
          tabIndex={0}
        >
          {current}
        </span>
        <div className="review-pinyin review-pinyin-lg">{pinyin}</div>
        <div className="review-gloss">{gloss || "(no dictionary entry)"}</div>
        <button
          type="button"
          className="review-tap-replay"
          onClick={(e) => {
            e.stopPropagation();
            speak(current);
          }}
        >
          🔊 replay
        </button>
        <div className="sift-actions">
          <button
            type="button"
            className="review-btn review-btn-again"
            onClick={() => decide("keep")}
          >
            ✗ Practice
          </button>
          <button
            type="button"
            className="review-btn review-btn-good"
            onClick={() => decide("know")}
          >
            ✓ Know it
          </button>
        </div>
      </div>
    </DrillShell>
  );
}
