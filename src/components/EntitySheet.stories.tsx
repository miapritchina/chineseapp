import type { Meta, StoryObj } from "@storybook/react-vite";
import { EntitySheet } from "./EntitySheet";
import { WORDS } from "../../.storybook/fixtures";

// The unified bottom sheet. Without the HanziWriter CDN script the
// single-char glyph renders its static fallback — layout is identical.
const meta = {
  title: "Sheet/EntitySheet",
  component: EntitySheet,
  parameters: { layout: "fullscreen" },
  args: {
    onClose: () => {},
    onBack: () => {},
    canGoBack: false,
    onOpenWord: () => {},
    onOpenChar: () => {},
    onOpenTree: () => {},
  },
} satisfies Meta<typeof EntitySheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MultiCharWord: Story = {
  args: { word: WORDS["你好"], charKey: undefined },
};
export const SingleChar: Story = {
  args: { word: null, charKey: "请" },
};
export const WithBackStack: Story = {
  args: { word: null, charKey: "好", canGoBack: true },
};
