import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

await build({
  configFile: false,
  publicDir: false,
  root: projectRoot,
  logLevel: "warn",
  build: {
    emptyOutDir: false,
    outDir: path.join(projectRoot, "public"),
    target: "es2020",
    minify: true,
    sourcemap: false,
    lib: {
      entry: path.join(projectRoot, "public/src/entries/learner.js"),
      formats: ["es"],
      fileName: () => "app.bundle.js",
    },
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});

console.log("Built public/app.bundle.js from the learner module graph.");
