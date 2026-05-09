import { useEffect, useRef, useState } from "react";
import type { Char } from "../lib/types";
import type { RatingName } from "../lib/fsrs";
import { speak, stopSpeech } from "../lib/speech";

interface Props {
  char: string;
  charData: Char | undefined;
  // Auto-grade: Easy = no mistakes, Good ≤ 2 mistakes, Again > 2.
  // Caller decides what to do with the rating; advance happens via the
  // tap-anywhere overlay after the quiz completes.
  onGrade: (rating: RatingName) => void;
  onSkip: () => void;
}

// HanziWriter is loaded as a global script tag (declared as `any` in
// useStrokeData.ts). We keep a structural type for the bits we touch
// rather than re-declaring the global to avoid a "must have identical
// modifiers" clash with the existing `any` declaration.
interface HanziWriterInstance {
  quiz: (opts: {
    onMistake?: (info: { totalMistakes: number; strokeNum: number }) => void;
    onCorrectStroke?: (info: { strokeNum: number }) => void;
    onComplete?: (info: { totalMistakes: number }) => void;
  }) => void;
  cancelQuiz: () => void;
}

// Production drill — "write the character that means X." Reveals the
// meaning + pinyin as the prompt, then the user traces the strokes via
// Hanzi Writer's quiz mode. Auto-grades on completion based on stroke
// mistakes; manual Skip available before the user starts tracing.
export function ProductionCard({ char, charData, onGrade, onSkip }: Props) {
  const writerRef = useRef<HTMLDivElement>(null);
  const writerInstanceRef = useRef<HanziWriterInstance | null>(null);
  const [done, setDone] = useState<{ mistakes: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const meaning = (charData?.definitions || []).slice(0, 2).join("; ");
  const pinyin = charData?.pinyin || "";

  // Mount the quiz once per character. Hanzi Writer manages its own DOM;
  // unmount cancels the in-flight quiz so leaving mid-trace doesn't
  // leave a ghost listener.
  useEffect(() => {
    const el = writerRef.current;
    if (!el) return;
    el.innerHTML = "";
    const HW = (window as unknown as { HanziWriter?: { create?: (...args: unknown[]) => HanziWriterInstance } }).HanziWriter;
    if (!HW || typeof HW.create !== "function") {
      setError("Hanzi Writer not loaded.");
      return;
    }
    let writer: HanziWriterInstance | null = null;
    try {
      const size = Math.min(280, el.clientWidth || 280);
      writer = HW.create(el, char, {
        width: size,
        height: size,
        padding: 6,
        showCharacter: false,
        showOutline: true,
        showHintAfterMisses: 1,
        highlightOnComplete: true,
        strokeColor:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--text")
            .trim() || "#222",
        outlineColor:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--border")
            .trim() || "#ddd",
      });
      if (!writer) throw new Error("HanziWriter.create returned null");
      writerInstanceRef.current = writer;
      writer.quiz({
        onMistake: (info) => setMistakes(info.totalMistakes),
        onComplete: (info) => setDone({ mistakes: info.totalMistakes }),
      });
    } catch (err) {
      console.error("HanziWriter quiz error for", char, err);
      setError("Couldn't load stroke data. Tap Skip.");
    }
    return () => {
      try {
        writer?.cancelQuiz();
      } catch {
        /* ignore */
      }
      stopSpeech();
    };
  }, [char]);

  // Speak the prompt when the drill mounts so the user knows what to
  // write — they're being asked to produce the character that matches
  // this sound + meaning.
  useEffect(() => {
    speak(char);
  }, [char]);

  const grade = (): RatingName => {
    const m = done?.mistakes ?? 0;
    if (m === 0) return "Easy";
    if (m <= 2) return "Good";
    return "Again";
  };

  const advance = () => {
    if (!done) return;
    onGrade(grade());
  };

  return (
    <div
      className={`phonetic-tap${done ? " is-tappable" : ""}`}
      onClick={done ? advance : undefined}
    >
      <div className="phonetic-tap-inner">
        <div className="phonetic-tap-prompt">Write the character that means…</div>
        <div className="production-prompt">
          <div className="production-prompt-pinyin">{pinyin}</div>
          <div className="production-prompt-gloss">{meaning || "(no gloss)"}</div>
        </div>
        <div ref={writerRef} className="production-writer" aria-label={`Trace ${char}`} />
        {error && <div className="phonetic-tap-feedback is-wrong">{error}</div>}
        {!done && (
          <div className="production-status">
            {mistakes === 0 ? "Trace each stroke in order." : `Mistakes: ${mistakes}`}
          </div>
        )}
        {done && (
          <>
            <div className="phonetic-tap-feedback is-correct">
              {done.mistakes === 0
                ? "Perfect — no mistakes."
                : `${done.mistakes} mistake${done.mistakes === 1 ? "" : "s"}.`}
            </div>
            <div className="drill-tap-hint">Tap anywhere to continue →</div>
          </>
        )}
        {!done && (
          <button
            type="button"
            className="review-btn review-btn-skip combined-skip"
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
