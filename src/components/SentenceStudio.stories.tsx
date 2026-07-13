import type { Meta, StoryObj } from "@storybook/react-vite";
import { SentenceStudio } from "./SentenceStudio";

// Signed-out (userId null) → draft + saved sentences stay local; the
// word bank comes from the fixture provider's saved words. Shows the
// composer, POS tabs, and POS-edged bank chips.
const meta = {
  title: "Pages/SentenceStudio",
  component: SentenceStudio,
  parameters: { layout: "fullscreen" },
  args: { userId: null },
} satisfies Meta<typeof SentenceStudio>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const FilteredBank: Story = { args: { externalQuery: "hao" } };
