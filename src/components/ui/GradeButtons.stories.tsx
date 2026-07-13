import type { Meta, StoryObj } from "@storybook/react-vite";
import { GradeButtons } from "./GradeButtons";

const meta = {
  title: "Primitives/GradeButtons",
  component: GradeButtons,
  args: { onPick: () => {} },
  decorators: [
    (Story) => (
      <div className="combined-grade-row" style={{ display: "flex", gap: 8 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GradeButtons>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const GoodPicked: Story = { args: { picked: "Good" } };
export const EasyPickedLocked: Story = { args: { picked: "Easy", locked: true } };
export const CustomLabels: Story = {
  args: { ratings: ["Again", "Good"], labels: { Again: "Missed some", Good: "Got them" } },
};
