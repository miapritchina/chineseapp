import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AppStateProvider } from "../state/contexts";
import type { Char } from "../lib/types";
import { ForgePage } from "./ForgePage";

vi.mock("../lib/speech", () => ({ autoSpeak: vi.fn(), stopSpeech: vi.fn() }));

const WORDS = ["学生", "生日", "中国", "电话", "朋友"];
const READINGS: Record<string, string> = {
  学: "xué",
  生: "shēng",
  日: "rì",
  中: "zhōng",
  国: "guó",
  电: "diàn",
  话: "huà",
  朋: "péng",
  友: "yǒu",
};
const chars = Object.fromEntries(
  Object.entries(READINGS).map(([c, pinyin]) => [c, { char: c, pinyin } as Char]),
);

describe("ForgePage", () => {
  it("shows each tile's pinyin under its character", () => {
    const { container } = render(
      <AppStateProvider
        saved={{
          saved: new Set(WORDS),
          savedList: WORDS.map((word) => ({ word, savedAt: 0 })),
          learned: new Set(),
          wrote: new Set(),
          review: new Set(),
          getStatus: () => null,
          setStatus: vi.fn(),
        }}
        dict={{
          findWord: () => null,
          ensureCached: async () => {},
          search: async () => [],
          error: null,
        }}
        chars={{ chars, ready: true }}
        mnemonics={{ get: () => null, save: () => {}, clear: () => {} }}
        auth={{
          user: null,
          loading: false,
          signInWithEmail: async () => ({ error: null }),
          signOut: async () => {},
        }}
      >
        <ForgePage onClose={() => {}} />
      </AppStateProvider>,
    );
    const tiles = [...container.querySelectorAll(".forge-tray .forge-piece")];
    expect(tiles.length).toBe(10);
    for (const t of tiles) {
      const c = t.firstChild!.textContent!;
      expect(t.querySelector(".forge-piece-pinyin")!.textContent).toBe(READINGS[c]);
    }
  });
});
