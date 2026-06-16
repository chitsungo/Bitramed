import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..", "public");
const port = Number(process.env.PORT || process.argv[2] || 3000);
const host = process.env.HOST || "127.0.0.1";
const idleExitArg = process.argv.find((arg) =>
  arg.startsWith("--idle-exit=")
);
const idleExitMs = idleExitArg
  ? Number(idleExitArg.replace("--idle-exit=", ""))
  : 0;
let idleExitTimer = null;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolvePublicPath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  const requestedPath = resolve(root, `.${pathname}`);
  const isInsideRoot =
    requestedPath === root || requestedPath.startsWith(`${root}${sep}`);
  if (!isInsideRoot) return null;

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return join(root, "index.html");
}

const server = createServer((request, response) => {
  scheduleIdleExit();
  const filePath = resolvePublicPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  const contentType =
    contentTypes[extname(filePath).toLowerCase()] ||
    "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}/`);
  scheduleIdleExit();
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
}

function scheduleIdleExit() {
  if (!idleExitMs) return;
  if (idleExitTimer) clearTimeout(idleExitTimer);
  idleExitTimer = setTimeout(shutdown, idleExitMs);
  idleExitTimer.unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
process.stdin.on("end", shutdown);
process.stdin.on("close", shutdown);

const parentProcessId = process.ppid;
setInterval(() => {
  try {
    process.kill(parentProcessId, 0);
  } catch {
    shutdown();
  }
}, 1000).unref();
