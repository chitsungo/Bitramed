import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const source = path.resolve(projectRoot, "apps", "admin", "out");
const publicRoot = path.resolve(projectRoot, "public");
const target = path.resolve(publicRoot, "JAK2V617F");
const legacyTarget = path.resolve(publicRoot, "admin");
const expectedTarget = path.join(publicRoot, "JAK2V617F");
const expectedLegacyTarget = path.join(publicRoot, "admin");

if (
  target !== expectedTarget ||
  legacyTarget !== expectedLegacyTarget ||
  !target.startsWith(publicRoot + path.sep) ||
  !legacyTarget.startsWith(publicRoot + path.sep)
) {
  throw new Error(
    `Refusing to publish outside the expected targets: ${target}, ${legacyTarget}`
  );
}

const sourceStats = await stat(source);
if (!sourceStats.isDirectory()) {
  throw new Error(`Admin export is missing: ${source}`);
}

await rm(legacyTarget, { recursive: true, force: true });
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

console.log("Published the Next.js admin export to public/JAK2V617F.");
