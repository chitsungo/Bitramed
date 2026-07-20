export default [
  {
    files: ["src/**/*.js", "src/**/*.jsx", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        URL: "readonly",
        console: "readonly",
        document: "readonly",
        DOMParser: "readonly",
        Intl: "readonly",
        JSON: "readonly",
        localStorage: "readonly",
        Map: "readonly",
        navigator: "readonly",
        Node: "readonly",
        Promise: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        URLSearchParams: "readonly",
        window: "readonly",
        __BITRAMED_E2E__: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-unreachable": "error",
      "prefer-const": "error",
    },
  },
];
