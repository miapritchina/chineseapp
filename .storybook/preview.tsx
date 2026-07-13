import React from "react";
import type { Preview } from "@storybook/react-vite";
import { AppStateProvider } from "../src/state/contexts";
import { providerProps } from "./fixtures";
import "../src/styles.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <AppStateProvider {...providerProps}>
        <Story />
      </AppStateProvider>
    ),
  ],
  parameters: {
    layout: "centered",
    backgrounds: { disable: true },
    docs: { toc: true },
  },
  tags: ["autodocs"],
};

export default preview;
