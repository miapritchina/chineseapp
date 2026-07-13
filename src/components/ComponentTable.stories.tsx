import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComponentTable } from "./ComponentTable";
import { CHARS } from "../../.storybook/fixtures";

const meta = {
  title: "Search/ComponentTable",
  component: ComponentTable,
  parameters: { layout: "fullscreen" },
  args: {
    savedWords: ["你好", "请", "中国"],
    chars: CHARS,
    onPick: () => {},
  },
} satisfies Meta<typeof ComponentTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
