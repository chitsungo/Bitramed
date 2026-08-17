import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve("public"),
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    proxy: {
      "/admin": {
        target: "http://127.0.0.1:3001",
        changeOrigin: false,
        ws: true,
      },
    },
  },
});
