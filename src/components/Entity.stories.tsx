import type { Meta, StoryObj } from "@storybook/react-vite";
import { Entity } from "./Entity";

const meta = {
  title: "Primitives/Entity",
  component: Entity,
  args: { itemKey: "你好", size: "md" },
  argTypes: {
    size: { control: "radio", options: ["tiny", "sm", "md", "lg", "hero"] },
    onTap: { control: false },
    hanziSlot: { control: false },
    word: { control: false },
  },
} satisfies Meta<typeof Entity>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tiny: Story = { args: { itemKey: "青", size: "tiny" } };
export const Small: Story = { args: { itemKey: "请", size: "sm" } };
export const Medium: Story = { args: { itemKey: "你好", size: "md" } };
export const Hero: Story = {
  args: { itemKey: "你好", size: "hero", showPinyin: false, showMeaning: false },
};
export const LongWordScales: Story = { args: { itemKey: "发展中国家", size: "md" } };
export const RoleTinted: Story = {
  args: { itemKey: "青", size: "tiny", roleColor: "var(--role-sound)" },
};
export const WithPos: Story = { args: { itemKey: "你好", size: "md", showPos: true } };
export const DrillFlashCorrect: Story = {
  args: { itemKey: "青", size: "tiny", className: "is-correct" },
};
export const DrillFlashWrong: Story = {
  args: { itemKey: "尔", size: "tiny", className: "is-wrong" },
};
export const Tappable: Story = {
  args: { itemKey: "请", size: "md", onTap: () => {} },
};
