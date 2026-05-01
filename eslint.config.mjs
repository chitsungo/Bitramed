export default [
  {
    files: ["src/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        URL: "readonly",
        console: "readonly",
        document: "readonly",
        Intl: "readonly",
        JSON: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        Node: "readonly",
        Promise: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        URLSearchParams: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unreachable": "error",
      "prefer-const": "error"
    }
  }
];
