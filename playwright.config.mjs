import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3000"
  },
  webServer: {
    command: "node scripts/static-server.mjs 3000 --idle-exit=5000",
    port: 3000,
    reuseExistingServer: true
  }
});
