import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClassicPage } from "./ClassicPage";
import type { ClassicData } from "../hooks/useSanzijing";

const sample: ClassicData = {
  title: "三字经",
  titleEn: "Three Character Classic",
  source: "Sample excerpt · Translation: Herbert Giles (1900), public domain",
  couplets: [
    { a: "人之初", b: "性本善", en: "Men at their birth are naturally good." },
    {
      a: "性相近",
      b: "习相远",
      en: "Their natures are much the same; their habits become widely different.",
    },
    {
      a: "苟不教",
      b: "性乃迁",
      en: "If foolishly there is no teaching, the nature will deteriorate.",
    },
  ],
};

// Fixture saved words are 你好/请/中国 → 人 and 之 render as unknown,
// 中 (from 中国) as known/highlighted.
const meta = {
  title: "Pages/ClassicPage",
  component: ClassicPage,
  parameters: { layout: "fullscreen" },
  args: { data: sample, onOpenChar: () => {}, onClose: () => {} },
} satisfies Meta<typeof ClassicPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Excerpt: Story = {};
export const Loading: Story = { args: { data: null } };
export const LoadError: Story = { args: { data: null, error: "HTTP 404" } };
