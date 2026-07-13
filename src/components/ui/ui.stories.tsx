import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "./EmptyState";
import { Eyebrow } from "./Eyebrow";
import { SectionHeader } from "./SectionHeader";

const pageHeaderMeta = {
  title: "Primitives/PageHeader",
  component: PageHeader,
  parameters: { layout: "fullscreen" },
  args: { onBack: () => {} },
} satisfies Meta<typeof PageHeader>;
export default pageHeaderMeta;
type PageHeaderStory = StoryObj<typeof pageHeaderMeta>;

export const WithTagAndProgress: PageHeaderStory = {
  args: { tag: "Word", progress: "3 / 12" },
};
export const BackOnly: PageHeaderStory = {};

export const EmptyStates: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: 24, padding: 24 }}>
      <EmptyState
        variant="review"
        title="All caught up."
        hint="Save a new word to add it to the review queue."
      />
      <EmptyState variant="inline" title="No matches." hint="Try a different component." />
    </div>
  ),
};

export const Labels: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gap: 16, padding: 24 }}>
      <Eyebrow>Confusable</Eyebrow>
      <SectionHeader name="Etymology" />
      <SectionHeader name="In your saved words" />
    </div>
  ),
};
