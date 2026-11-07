import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../../../packages/ui/**/*.stories.tsx", "../../../packages/charts/**/*.stories.tsx"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-interactions", "@storybook/addon-a11y"],
  staticDirs: ["../public"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
  // The shared tsconfig uses jsx: preserve for Next; Vite needs the automatic runtime.
  viteFinal: (vite) =>
    mergeConfig(vite, { plugins: [tailwindcss()], esbuild: { jsx: "automatic" } }),
};

export default config;
