import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppStateProvider } from "../state/contexts";
import type { Word } from "../lib/types";
import { FlashcardsPage } from "./FlashcardsPage";

vi.mock("../lib/speech", () => ({
  autoSpeak: vi.fn(),
  prefetchSpeech: vi.fn(),
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  firstReading: (s: string) => s,
}));
import { autoSpeak, prefetchSpeech, speak } from "../lib/speech";

const WORDS: Record<string, Word> = {
  好: {
    word: "好",
    pinyin: "hǎo",
    searchablePinyin: "hao",
    definitions: ["good"],
    hsk: 1,
    rank: 1,
    simp: "好",
    chars: ["好"],
  },
  水: {
    word: "水",
    pinyin: "shuǐ",
    searchablePinyin: "shui",
    definitions: ["water"],
    hsk: 1,
    rank: 2,
    simp: "水",
    chars: ["水"],
  },
};

function wrap(ui: ReactNode) {
  return render(
    <AppStateProvider
      saved={{
        saved: new Set(),
        savedList: [],
        learned: new Set(),
        wrote: new Set(),
        review: new Set(),
        getStatus: () => null,
        setStatus: vi.fn(),
      }}
      dict={{
        findWord: (k) => WORDS[k] ?? null,
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

function renderDeck() {
  return wrap(
    <FlashcardsPage
      words={["好", "水"]}
      onClose={() => {}}
      onGrade={() => {}}
      onBrowse={() => {}}
    />,
  );
}

describe("FlashcardsPage auto-play", () => {
  beforeEach(() => {
    vi.mocked(autoSpeak).mockClear();
    vi.mocked(prefetchSpeech).mockClear();
    vi.mocked(speak).mockClear();
  });

  it("speaks the word as soon as the card is shown, before any flip", () => {
    renderDeck();
    expect(autoSpeak).toHaveBeenCalledWith("好");
    expect(autoSpeak).toHaveBeenCalledTimes(1);
  });

  it("does not speak again on flip", () => {
    const { container } = renderDeck();
    fireEvent.click(container.querySelector(".flashcard-surface")!);
    expect(screen.getByText("hǎo")).toBeTruthy();
    expect(autoSpeak).toHaveBeenCalledTimes(1);
  });

  it("speaks the next word when the deck advances", () => {
    const { container } = renderDeck();
    const surface = () => container.querySelector(".flashcard-surface")!;
    fireEvent.click(surface());
    fireEvent.click(surface());
    expect(autoSpeak).toHaveBeenLastCalledWith("水");
    expect(autoSpeak).toHaveBeenCalledTimes(2);
  });

  it("warms the audio for cards ahead of the one on screen", () => {
    renderDeck();
    expect(prefetchSpeech).toHaveBeenCalledWith(["好", "水"]);
  });
});
