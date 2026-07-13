import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusButton } from "./StatusButton";

const meta = {
  title: "Primitives/StatusButton",
  component: StatusButton,
  args: { status: null, onChange: () => {} },
  argTypes: {
    status: { control: "radio", options: [null, "saved", "review", "learned", "wrote"] },
  },
} satisfies Meta<typeof StatusButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Saved: Story = { args: { status: "saved" } };
export const NeedToLearn: Story = { args: { status: "review" } };
export const Learned: Story = { args: { status: "learned" } };
export const Wrote: Story = { args: { status: "wrote" } };
