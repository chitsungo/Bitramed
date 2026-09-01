import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    files: ["src/**/*.js", "public/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        AbortController: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        crypto: "readonly",
        document: "readonly",
        Element: "readonly",
        Event: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        HTMLButtonElement: "readonly",
        HTMLElement: "readonly",
        IntersectionObserver: "readonly",
        Intl: "readonly",
        JSON: "readonly",
        KeyboardEvent: "readonly",
        localStorage: "readonly",
        MutationObserver: "readonly",
        navigator: "readonly",
        Node: "readonly",
        Promise: "readonly",
        requestAnimationFrame: "readonly",
        sessionStorage: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "error",
      "no-unreachable": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        document: "writable",
        getComputedStyle: "readonly",
        globalThis: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        window: "writable",
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "error",
      "no-unreachable": "error",
      "prefer-const": "error",
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/web/*.ts"],
  })),
  {
    files: ["apps/web/src/**/*.{ts,tsx}", "apps/web/*.ts"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
