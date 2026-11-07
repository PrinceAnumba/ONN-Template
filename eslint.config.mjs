import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/storybook-static/**",
      "apps/*/public/vendor/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/generated/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.tsx"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y, "@next/next": nextPlugin },
    settings: { react: { version: "19" }, next: { rootDir: "apps/*/" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "off",
      // All UI text goes through next-intl or the country config (brief §9).
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true, allowedStrings: [] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|title|alt|placeholder)$/] > Literal[value=/./]",
          message: "User-visible attributes must come from next-intl or the country config.",
        },
      ],
    },
  },
  {
    // Stories are fixtures, written in English.
    files: ["**/*.stories.tsx", "**/*.stories-helpers.tsx"],
    rules: { "react/jsx-no-literals": "off", "no-restricted-syntax": "off" },
  },
  prettier,
);
