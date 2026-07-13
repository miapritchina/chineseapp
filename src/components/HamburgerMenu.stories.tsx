import type { Meta, StoryObj } from "@storybook/react-vite";
import { HamburgerMenu } from "./HamburgerMenu";

// Tap the ☰ button to open the drawer (it owns its open state).
const meta = {
  title: "Home/HamburgerMenu",
  component: HamburgerMenu,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <header className="topbar">
        <Story />
        <h1>中文</h1>
      </header>
    ),
  ],
  args: {
    version: "chinese v99",
    reviewHref: "#/review",
    phoneticsHref: "#/phonetics",
    onShareWords: () => {},
    wordCount: 500,
  },
} satisfies Meta<typeof HamburgerMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDueBadge: Story = { args: { reviewBadge: 12 } };
