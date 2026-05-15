import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist", "node_modules", "scripts/test-*.mjs", "src/lib/*.mjs", "**/*.cjs"] },
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        history: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        console: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLCanvasElement: "readonly",
        Element: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        TouchEvent: "readonly",
        TouchList: "readonly",
        Touch: "readonly",
        PointerEvent: "readonly",
        FocusEvent: "readonly",
        SVGElement: "readonly",
        SVGSVGElement: "readonly",
        PopStateEvent: "readonly",
        getComputedStyle: "readonly",
        React: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin, react: reactPlugin, "react-hooks": reactHooksPlugin },
    settings: { react: { version: "18" } },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // eslint-plugin-react-hooks v7 adds a wave of strict rules that
      // flag patterns the existing codebase relies on (ref-during-
      // render for layout measurement, setState-in-effect for FSRS
      // seeding per ADR-0008, etc.). These don't break runtime
      // behavior — disable for now; re-enable selectively once we
      // migrate intentional violations to safer patterns.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/gating": "off",
      "react-hooks/globals": "off",
      "react-hooks/config": "off",
      "react-hooks/fbt": "off",
    },
  },
];
