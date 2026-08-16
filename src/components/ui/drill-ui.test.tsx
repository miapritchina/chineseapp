import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GradeButtons } from "./GradeButtons";
import { DrillShell } from "./DrillShell";
import { HanziGlyph, type HanziGlyphHandle } from "./HanziGlyph";

describe("GradeButtons", () => {
  it("renders Again/Good/Easy and fires onPick + stops propagation", () => {
    const onPick = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <GradeButtons onPick={onPick} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Know" }));
    expect(onPick).toHaveBeenCalledWith("Good");
    expect(onParent).not.toHaveBeenCalled();
  });

  it("locked: click bubbles and does not record a grade", () => {
    const onPick = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <GradeButtons onPick={onPick} locked />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confident" }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onParent).toHaveBeenCalledTimes(1);
  });

  it("marks the picked rating and honors custom labels", () => {
    render(
      <GradeButtons
        onPick={() => {}}
        picked="Again"
        labels={{ Again: "Need work", Good: "Knew most", Easy: "Knew all" }}
      />,
    );
    const again = screen.getByRole("button", { name: "Need work" });
    expect(again.className).toContain("is-picked");
    expect(again.className).toContain("review-btn-again");
    expect(screen.getByRole("button", { name: "Knew all" })).toBeTruthy();
  });
});

describe("DrillShell", () => {
  it("renders tag/progress/body and wires back + skip", () => {
    const onClose = vi.fn();
    const onSkip = vi.fn();
    render(
      <DrillShell tag="Word" progressIndex={2} total={8} onClose={onClose} onSkip={onSkip}>
        <div>body</div>
      </DrillShell>,
    );
    expect(screen.getByText("Word")).toBeTruthy();
    expect(screen.getByText("2 / 8")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("8");
    fireEvent.click(screen.getByRole("button", { name: "← Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe("HanziGlyph", () => {
  afterEach(() => {
    delete (window as unknown as { HanziWriter?: unknown }).HanziWriter;
    vi.restoreAllMocks();
  });

  it("animate: creates the writer, animates, and replays via ref", () => {
    const animateCharacter = vi.fn();
    const create = vi.fn(() => ({ animateCharacter }));
    (window as unknown as { HanziWriter: unknown }).HanziWriter = { create };

    const ref = createRef<HanziGlyphHandle>();
    render(<HanziGlyph ref={ref} char="好" mode="animate" />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(animateCharacter).toHaveBeenCalledTimes(1);
    ref.current?.replay();
    expect(animateCharacter).toHaveBeenCalledTimes(2);
  });

  it("animate: paints a text fallback when HanziWriter is absent", () => {
    const { container } = render(<HanziGlyph char="好" mode="animate" />);
    const fb = container.querySelector(".sheet-glyph-fallback");
    expect(fb?.textContent).toBe("好");
  });

  it("quiz: runs quiz and forwards onComplete mistakes", () => {
    let completeCb: ((info: { totalMistakes: number }) => void) | undefined;
    const quiz = vi.fn((opts) => {
      completeCb = opts.onComplete;
    });
    const create = vi.fn(() => ({ quiz, cancelQuiz: vi.fn() }));
    (window as unknown as { HanziWriter: unknown }).HanziWriter = { create };

    const onComplete = vi.fn();
    render(<HanziGlyph char="好" mode="quiz" onComplete={onComplete} />);
    expect(quiz).toHaveBeenCalledTimes(1);
    completeCb?.({ totalMistakes: 2 });
    expect(onComplete).toHaveBeenCalledWith(2);
  });

  it("quiz: reports onError when HanziWriter is absent", () => {
    const onError = vi.fn();
    render(<HanziGlyph char="好" mode="quiz" onError={onError} />);
    expect(onError).toHaveBeenCalledWith("Hanzi Writer not loaded.");
  });
});
