import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResultsList } from "./ResultsList";
import { WORDS } from "../../.storybook/fixtures";

const meta = {
  title: "Search/ResultsList",
  component: ResultsList,
  parameters: { layout: "fullscreen" },
  args: { onOpen: () => {} },
} satisfies Meta<typeof ResultsList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Matches: Story = {
  args: { matches: Object.values(WORDS) },
};
export const SingleMatch: Story = {
  args: { matches: [WORDS["你好"]] },
};
export const Empty: Story = { args: { matches: [] } };
