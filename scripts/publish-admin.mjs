import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const source = path.resolve(projectRoot, "apps", "admin", "out");
const target = path.resolve(projectRoot, "public", "admin");
const expectedTarget = path.join(projectRoot, "public", "admin");

if (
  target !== expectedTarget ||
  !target.startsWith(path.join(projectRoot, "public") + path.sep)
) {
  throw new Error(
    `Refusing to publish outside the expected admin target: ${target}`
  );
}

const sourceStats = await stat(source);
if (!sourceStats.isDirectory()) {
  throw new Error(`Admin export is missing: ${source}`);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

console.log("Published the Next.js admin export to public/admin.");
