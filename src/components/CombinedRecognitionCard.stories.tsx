import type { Meta, StoryObj } from "@storybook/react-vite";
import { CombinedRecognitionCard } from "./CombinedRecognitionCard";
import { WORDS, CHARS } from "../../.storybook/fixtures";

const meta = {
  title: "Review/CombinedRecognitionCard",
  component: CombinedRecognitionCard,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="review-root" style={{ minHeight: "100vh" }}>
        <div className="review-body">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    itemKey: "你好",
    itemKind: "word",
    word: WORDS["你好"],
    charData: undefined,
    onGrade: () => {},
    onSkip: () => {},
  },
} satisfies Meta<typeof CombinedRecognitionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

// Tap to reveal, then ONE Again/Good/Easy row grades meaning + sound
// together (v102).
export const Word: Story = {};
export const SingleChar: Story = {
  args: { itemKey: "请", word: WORDS["请"], charData: CHARS["请"] },
};
