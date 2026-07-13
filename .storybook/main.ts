import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Storybook merges the project vite.config — strip the app-specific
  // base path and the PWA plugin (no service worker inside Storybook).
  viteFinal: async (cfg) => ({
    ...cfg,
    base: "./",
    plugins: (cfg.plugins ?? [])
      .flat()
      .filter((p) => !(p && "name" in (p as object) && String((p as { name?: string }).name).includes("pwa"))),
  }),
};

export default config;
