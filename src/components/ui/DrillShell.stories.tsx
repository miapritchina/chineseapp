import type { Meta, StoryObj } from "@storybook/react-vite";
import { DrillShell } from "./DrillShell";
import { SpeakButton } from "./SpeakButton";
import { HanziGlyph } from "./HanziGlyph";

const meta = {
  title: "Primitives/DrillShell",
  component: DrillShell,
  parameters: { layout: "fullscreen" },
  args: {
    tag: "Word",
    progressIndex: 3,
    total: 12,
    onClose: () => {},
    onSkip: () => {},
    children: <div className="review-empty-hint">Drill content renders here.</div>,
  },
} satisfies Meta<typeof DrillShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoSkip: Story = { args: { onSkip: undefined } };

export const SpeakButtonStory: StoryObj = {
  name: "SpeakButton",
  render: () => (
    <div style={{ padding: 24 }}>
      <SpeakButton text="你好" />
    </div>
  ),
};

// Falls back to a plain glyph without the HanziWriter CDN script;
// in the app it animates stroke order.
export const HanziGlyphAnimate: StoryObj = {
  render: () => (
    <div style={{ padding: 24 }}>
      <HanziGlyph char="好" mode="animate" maxSize={160} />
    </div>
  ),
};
