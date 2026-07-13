import type { Meta, StoryObj } from "@storybook/react-vite";
import { SavedShelf } from "./SavedShelf";

// Data comes from the fixture AppStateProvider (see .storybook/preview):
// 你好 + 请 saved, 中国 learned — so both shelf sections render.
const meta = {
  title: "Home/SavedShelf",
  component: SavedShelf,
  parameters: { layout: "fullscreen" },
  args: { onOpenWord: () => {}, onOpenChar: () => {} },
} satisfies Meta<typeof SavedShelf>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoSections: Story = {};
