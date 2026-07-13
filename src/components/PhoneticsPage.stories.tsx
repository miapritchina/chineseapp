import type { Meta, StoryObj } from "@storybook/react-vite";
import { PhoneticsPage } from "./PhoneticsPage";
import { PHONETIC_COMPONENTS } from "../../.storybook/fixtures";

const meta = {
  title: "Pages/PhoneticsPage",
  component: PhoneticsPage,
  parameters: { layout: "fullscreen" },
  args: { components: PHONETIC_COMPONENTS, ready: true, onClose: () => {} },
} satisfies Meta<typeof PhoneticsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { components: [], ready: false } };
