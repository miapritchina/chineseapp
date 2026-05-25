import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppStateProvider } from "../state/contexts";
import type { Word } from "../lib/types";
import { Entity } from "./Entity";

const HAO: Word = {
  word: "好",
  pinyin: "hǎo",
  searchablePinyin: "hao",
  definitions: ["good", "fine"],
  hsk: 1,
  rank: 1,
  simp: "好",
  chars: ["好"],
};

const setStatus = vi.fn();

function wrap(ui: ReactNode, status: "saved" | null = null) {
  return render(
    <AppStateProvider
      saved={{
        saved: new Set(status ? ["好"] : []),
        savedList: [],
        learned: new Set(),
        wrote: new Set(),
        review: new Set(),
        getStatus: () => status,
        setStatus,
      }}
      dict={{
        findWord: (k) => (k === "好" ? HAO : null),
        ensureCached: async () => {},
        search: async () => [],
        error: null,
      }}
      chars={{ chars: {}, ready: true }}
      mnemonics={{ get: () => null, save: () => {}, clear: () => {} }}
      auth={{
        user: null,
        loading: false,
        signInWithEmail: async () => ({ error: null }),
        signOut: async () => {},
      }}
    >
      {ui}
    </AppStateProvider>,
  );
}

describe("Entity", () => {
  it("tiny: hanzi only by default (no pinyin / meaning / status)", () => {
    const { container } = wrap(<Entity word={HAO} size="tiny" />);
    expect(container.querySelector(".entity-hanzi")?.textContent).toBe("好");
    expect(container.querySelector(".entity-pinyin")).toBeNull();
    expect(container.querySelector(".entity-meaning")).toBeNull();
    expect(container.querySelector(".entity-status")).toBeNull();
  });

  it("sm: shows pinyin + meaning, no POS by default, no status corner", () => {
    const { container } = wrap(<Entity word={HAO} size="sm" />);
    expect(container.querySelector(".entity-pinyin")?.textContent).toBe("hǎo");
    expect(container.querySelector(".entity-meaning")?.textContent).toContain("good");
    expect(container.querySelector(".entity-pos")).toBeNull();
    expect(container.querySelector(".entity-status")).toBeNull();
  });

  it("renders the POS pill only when showPos is true", () => {
    const { container } = wrap(<Entity word={HAO} size="sm" showPos />);
    expect(container.querySelector(".entity-pos")).not.toBeNull();
  });

  it("md: adds the status corner", () => {
    const { container } = wrap(<Entity word={HAO} size="md" />, "saved");
    expect(container.querySelector(".entity-status")).not.toBeNull();
  });

  it("resolves a word from context by itemKey", () => {
    const { container } = wrap(<Entity itemKey="好" size="sm" />);
    expect(container.querySelector(".entity-pinyin")?.textContent).toBe("hǎo");
  });

  it("fires onTap (and is keyboard-activatable) when interactive", () => {
    const onTap = vi.fn();
    wrap(<Entity word={HAO} size="md" onTap={onTap} />, "saved");
    const el = screen.getByRole("button", { name: /好/ });
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenCalledWith("好");
  });

  it("applies the role-color custom property and renders trailing content", () => {
    const { container } = wrap(
      <Entity
        word={HAO}
        size="tiny"
        roleColor="var(--role-sound)"
        trailing={<span>3 words</span>}
      />,
    );
    const el = container.querySelector(".entity") as HTMLElement;
    expect(el.style.getPropertyValue("--entity-role")).toBe("var(--role-sound)");
    expect(container.textContent).toContain("3 words");
  });

  it("status corner click does not trigger onTap", () => {
    const onTap = vi.fn();
    const { container } = wrap(<Entity word={HAO} size="md" onTap={onTap} />, "saved");
    const corner = container.querySelector(".entity-status") as HTMLElement;
    fireEvent.click(corner);
    expect(onTap).not.toHaveBeenCalled();
  });
});
