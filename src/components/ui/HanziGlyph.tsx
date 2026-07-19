import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Consolidates the two near-identical HanziWriter mounts that were
// inlined in EntitySheet (animate mode) and ProductionCard (trace-quiz
// mode). HanziWriter is a global script tag — when it's absent or the
// per-char data fails to load, animate mode paints a plain-text
// fallback and quiz mode reports via onError.
//
// Shared scaffolding: clear the container, read --text / --border via
// getComputedStyle, create the writer, and clean up on unmount
// (cancelQuiz for quiz, null-out for animate). Re-runs only when `char`
// changes — the single effect keyed on `char` is also the StrictMode
// double-mount guard (cleanup runs between the doubled mounts).

interface HWInstance {
  animateCharacter?: () => void;
  quiz?: (opts: {
    onMistake?: (info: { totalMistakes: number; strokeNum: number }) => void;
    onComplete?: (info: { totalMistakes: number }) => void;
  }) => void;
  cancelQuiz?: () => void;
}

export interface HanziGlyphHandle {
  replay: () => void;
}

interface Props {
  char: string;
  mode: "animate" | "quiz";
  maxSize?: number;
  padding?: number;
  className?: string;
  fallbackClassName?: string;
  ariaLabel?: string;
  onMistake?: (totalMistakes: number, strokeNum: number) => void;
  onComplete?: (totalMistakes: number) => void;
  onError?: (message: string) => void;
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const HanziGlyph = forwardRef<HanziGlyphHandle, Props>(function HanziGlyph(
  {
    char,
    mode,
    maxSize = 220,
    padding = 4,
    className,
    fallbackClassName = "sheet-glyph-fallback",
    ariaLabel,
    onMistake,
    onComplete,
    onError,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<HWInstance | null>(null);

  useImperativeHandle(ref, () => ({
    replay: () => instanceRef.current?.animateCharacter?.(),
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const HW = (window as unknown as { HanziWriter?: { create?: (...a: unknown[]) => HWInstance } })
      .HanziWriter;

    const paintFallback = () => {
      el.innerHTML = "";
      const fb = document.createElement("div");
      fb.className = fallbackClassName;
      fb.textContent = char;
      el.appendChild(fb);
    };

    if (!HW || typeof HW.create !== "function") {
      if (mode === "quiz") onError?.("Hanzi Writer not loaded.");
      else paintFallback();
      return;
    }

    const size = Math.min(maxSize, el.clientWidth || maxSize);
    const strokeColor = cssVar("--text", "#222");
    const outlineColor = cssVar("--border", "#ddd");
    let writer: HWInstance | null = null;
    try {
      if (mode === "animate") {
        writer = HW.create(el, char, {
          width: size,
          height: size,
          padding,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 110,
          strokeColor,
          outlineColor,
          onLoadCharDataError: paintFallback,
        });
        instanceRef.current = writer;
        writer?.animateCharacter?.();
      } else {
        writer = HW.create(el, char, {
          width: size,
          height: size,
          padding,
          showCharacter: false,
          showOutline: true,
          showHintAfterMisses: 1,
          highlightOnComplete: true,
          strokeColor,
          outlineColor,
        });
        if (!writer) throw new Error("HanziWriter.create returned null");
        instanceRef.current = writer;
        writer.quiz?.({
          onMistake: (info) => onMistake?.(info.totalMistakes, info.strokeNum),
          onComplete: (info) => onComplete?.(info.totalMistakes),
        });
      }
    } catch (err) {
      if (mode === "quiz") {
        console.error("HanziWriter quiz error for", char, err);
        onError?.("Couldn't load stroke data. Tap Skip.");
      } else {
        paintFallback();
      }
    }

    return () => {
      if (mode === "quiz") {
        try {
          instanceRef.current?.cancelQuiz?.();
        } catch {
          /* ignore */
        }
      }
      instanceRef.current = null;
    };
    // onMistake/onComplete/onError are intentionally excluded — the
    // writer is mounted per `char`, not per callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, mode, maxSize, padding, fallbackClassName]);

  return <div ref={containerRef} className={className} aria-label={ariaLabel} />;
});
