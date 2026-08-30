import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppStateProvider } from "../state/contexts";
import type { Word } from "../lib/types";
import { CombinedRecognitionCard } from "./CombinedRecognitionCard";
import { WordInferenceCard } from "./WordInferenceCard";
import { DisambiguationCard } from "./DisambiguationCard";
import { ClusterRecallCard } from "./ClusterRecallCard";

vi.mock("../lib/speech", () => ({
  autoSpeak: vi.fn(),
  prefetchSpeech: vi.fn(),
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  firstReading: (s: string) => s,
}));
import { autoSpeak, speak } from "../lib/speech";

const HAO: Word = {
  word: "好",
  pinyin: "hǎo",
  searchablePinyin: "hao",
  definitions: ["good"],
  hsk: 1,
  rank: 1,
  simp: "好",
  chars: ["好"],
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

// When each surface speaks. The rule: audio arrives with the character
// wherever the character is the stimulus, and waits for the reveal
// wherever the sound is itself the answer being graded.
describe("drill audio timing", () => {
  beforeEach(() => {
    vi.mocked(autoSpeak).mockClear();
    vi.mocked(speak).mockClear();
  });

  it("recognition card stays silent until the reveal — the Sound row grades recall", () => {
    const { container } = wrap(
      <CombinedRecognitionCard
        itemKey="好"
        itemKind="word"
        word={HAO}
        charData={undefined}
        onGraded={() => {}}
      />,
    );
    expect(autoSpeak).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".combined-card-surface")!);
    expect(autoSpeak).toHaveBeenCalledWith("好");
  });

  it("new-words card speaks with the prompt — the answer is a meaning", () => {
    wrap(
      <WordInferenceCard
        word={HAO}
        glossPool={["bad", "big", "small"]}
        onGotIt={() => {}}
        onMissed={() => {}}
      />,
    );
    expect(autoSpeak).toHaveBeenCalledWith("好");
  });

  it("disambiguation speaks the focus character on show", () => {
    wrap(<DisambiguationCard focus="末" neighbors={["未"]} onContinue={() => {}} />);
    expect(autoSpeak).toHaveBeenCalledWith("末");
    expect(autoSpeak).toHaveBeenCalledTimes(1);
  });

  it("cluster recall reveals through autoSpeak, so the Sound toggle mutes it", () => {
    wrap(<ClusterRecallCard cluster={["好", "妈"]} onGraded={() => {}} />);
    expect(autoSpeak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Tap to reveal 好"));
    expect(autoSpeak).toHaveBeenCalledWith("好");
    expect(speak).not.toHaveBeenCalled();
  });
});
