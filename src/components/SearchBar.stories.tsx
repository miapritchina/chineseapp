import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchBar } from "./SearchBar";
import type { SearchMode } from "../state/uiStore";

// Interactive wrapper — the real component is controlled.
function Harness({
  initialMode,
  initialValue,
}: {
  initialMode: SearchMode;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [mode, setMode] = useState<SearchMode>(initialMode);
  return (
    <SearchBar
      value={value}
      onChange={setValue}
      onEnter={() => {}}
      mode={mode}
      onModeChange={setMode}
    />
  );
}

const meta = {
  title: "Search/SearchBar",
  component: SearchBar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SearchBar>;
export default meta;

export const Dictionary: StoryObj = { render: () => <Harness initialMode="all" /> };
export const ByComponent: StoryObj = { render: () => <Harness initialMode="byComponent" /> };
export const Sentence: StoryObj = { render: () => <Harness initialMode="sentence" /> };
export const WithQuery: StoryObj = {
  render: () => <Harness initialMode="all" initialValue="你好" />,
};
