import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewLaunch } from "./ReviewLaunch";

const meta = {
  title: "Review/ReviewLaunch",
  component: ReviewLaunch,
  parameters: { layout: "fullscreen" },
  args: {
    totalDue: 14,
    facetCounts: {
      meaningRecognition: 5,
      soundRecognition: 5,
      wordInference: 3,
      reverseRecognition: 4,
      clozeChar: 2,
      familySweep: 1,
      clusterRecall: 2,
      production: 1,
    },
    onStart: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof ReviewLaunch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllDrillTypes: Story = {};
export const NothingDue: Story = { args: { totalDue: 0, facetCounts: {} } };
