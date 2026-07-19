import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { WordInferenceCard } from "./WordInferenceCard";
import { ReverseRecognitionCard } from "./ReverseRecognitionCard";
import { ClozeCharCard } from "./ClozeCharCard";
import { FamilySweepCard } from "./FamilySweepCard";
import { ClusterRecallCard } from "./ClusterRecallCard";
import { ProductionCard } from "./ProductionCard";
import { DisambiguationCard } from "./DisambiguationCard";
import { DrillShell } from "./ui/DrillShell";
import { WORDS, CHARS, PHONETIC_COMPONENTS } from "../../.storybook/fixtures";

// Every drill rendered inside the real DrillShell chrome, against the
// fixture provider. One file so the "Review/Drills" section reads as a
// catalog; autodocs still generates a prop table per component.

function Shell({ tag, children }: { tag: string; children: ReactNode }) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <DrillShell tag={tag} progressIndex={3} total={12} onClose={() => {}} onSkip={() => {}}>
        {children}
      </DrillShell>
    </div>
  );
}

const meta = {
  title: "Review/Drills",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;

const savedWords = ["你好", "请", "中国", "学习", "朋友"];

export const WordInference: StoryObj = {
  render: () => (
    <Shell tag="New word">
      <WordInferenceCard
        word={WORDS["中国"]}
        glossPool={["hello; hi", "to study; to learn", "friend"]}
        onGotIt={() => {}}
        onMissed={() => {}}
      />
    </Shell>
  ),
};

export const ReverseRecognition: StoryObj = {
  render: () => (
    <Shell tag="Reverse">
      <ReverseRecognitionCard
        answer="你好"
        gloss="hello; hi"
        savedWords={savedWords}
        onGrade={() => {}}
      />
    </Shell>
  ),
};

export const ClozeChar: StoryObj = {
  render: () => (
    <Shell tag="Cloze">
      <ClozeCharCard word="你好" gloss="hello; hi" savedWords={savedWords} onGrade={() => {}} />
    </Shell>
  ),
};

export const FamilySweep: StoryObj = {
  render: () => (
    <Shell tag="Family sweep">
      <FamilySweepCard
        component={PHONETIC_COMPONENTS[0]}
        pool={PHONETIC_COMPONENTS}
        charExists={(c) => !!CHARS[c]}
        onGrade={() => {}}
      />
    </Shell>
  ),
};

export const ClusterRecall: StoryObj = {
  render: () => (
    <Shell tag="Cluster">
      <ClusterRecallCard cluster={["请", "情", "清"]} onGraded={() => {}} />
    </Shell>
  ),
};

// Without the HanziWriter CDN script the trace canvas shows its static
// fallback — the prompt/skip layout is what this story documents.
export const Production: StoryObj = {
  render: () => (
    <Shell tag="Write">
      <ProductionCard char="请" charData={CHARS["请"]} onGrade={() => {}} />
    </Shell>
  ),
};

export const Disambiguation: StoryObj = {
  render: () => (
    <Shell tag="Confusable">
      <DisambiguationCard focus="请" neighbors={["情", "清"]} onContinue={() => {}} />
    </Shell>
  ),
};
