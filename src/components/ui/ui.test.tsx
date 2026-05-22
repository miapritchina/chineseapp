import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";
import { Eyebrow } from "./Eyebrow";
import { SectionHeader } from "./SectionHeader";
import { SpeakButton } from "./SpeakButton";

vi.mock("../../lib/speech", () => ({ speak: vi.fn() }));
import { speak } from "../../lib/speech";

describe("PageHeader", () => {
  it("fires onBack and renders tag + progress", () => {
    const onBack = vi.fn();
    render(<PageHeader onBack={onBack} tag="Word" progress="2 / 9" />);
    expect(screen.getByText("Word")).toBeTruthy();
    expect(screen.getByText("2 / 9")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "← Done" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders actions instead of progress when provided", () => {
    render(<PageHeader onBack={() => {}} actions={<span>act</span>} />);
    expect(screen.getByText("act")).toBeTruthy();
  });

  it("honors a custom back label", () => {
    render(<PageHeader onBack={() => {}} backLabel="← Back" />);
    expect(screen.getByRole("button", { name: "← Back" })).toBeTruthy();
  });
});

describe("EmptyState", () => {
  it("inline variant joins title + hint", () => {
    const { container } = render(<EmptyState title="No matches." />);
    expect(container.querySelector(".empty-state")?.textContent).toContain("No matches.");
  });

  it("review variant renders title + hint blocks", () => {
    const { container } = render(
      <EmptyState variant="review" title="All caught up." hint="Save a word." />,
    );
    expect(container.querySelector(".review-empty-title")?.textContent).toBe("All caught up.");
    expect(container.querySelector(".review-empty-hint")?.textContent).toBe("Save a word.");
  });
});

describe("Eyebrow", () => {
  it("defaults to the kind-tag class, overridable", () => {
    const { container, rerender } = render(<Eyebrow>etymology</Eyebrow>);
    expect(container.querySelector(".review-kind-tag")?.textContent).toBe("etymology");
    rerender(<Eyebrow className="sheet-eyebrow">x</Eyebrow>);
    expect(container.querySelector(".sheet-eyebrow")).toBeTruthy();
  });
});

describe("SectionHeader", () => {
  it("zero-pads the number", () => {
    const { container } = render(<SectionHeader num={1} name="ETYMOLOGY" />);
    expect(container.querySelector(".sheet-section-num")?.textContent).toBe("Nº 01");
    expect(container.querySelector(".sheet-section-name")?.textContent).toBe("ETYMOLOGY");
  });
});

describe("SpeakButton", () => {
  it("calls speak(text) and stops propagation", () => {
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <SpeakButton text="你好" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(speak).toHaveBeenCalledWith("你好");
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
