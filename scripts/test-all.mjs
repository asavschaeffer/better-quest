import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function safeResolveFromRoot(urlPathname) {
  const stripped = (urlPathname || "/").split("?")[0].split("#")[0];
  const pathname = decodeURIComponent(stripped);
  const rel = pathname === "/" ? "/index.html" : pathname;
  const full = path.resolve(repoRoot, "." + rel);
  if (!full.startsWith(repoRoot)) return null;
  return full;
}

function startStaticServer({ port }) {
  const server = http.createServer(async (req, res) => {
    try {
      const filePath = safeResolveFromRoot(req.url);
      if (!filePath) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end("Bad request");
        return;
      }

      const data = await readFile(filePath);
      res.writeHead(200, { "content-type": contentTypeFor(filePath) });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
}

function runNodeScript(relPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(repoRoot, relPath)], {
      stdio: "inherit",
      cwd: repoRoot,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function runNodeArgs(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      cwd: repoRoot,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

let exitCode = 0;

console.log("\n=== Better Quest: test:all ===");

// 1) Backend/unit tests (no server)
exitCode ||= await runNodeScript("tests/test.js");
exitCode ||= await runNodeScript("tests/fatigue.test.js");

// 1b) Mobile mechanics/unit tests (node:test)
exitCode ||= await runNodeArgs([
  "--test",
  path.join(repoRoot, "mobile/tests/mechanics.test.mjs"),
  path.join(repoRoot, "mobile/tests/bonuses.test.mjs"),
  path.join(repoRoot, "mobile/tests/fatigue_adapt.test.mjs"),
  path.join(repoRoot, "mobile/tests/stats.test.mjs"),
]);

// 2) Browser tests (needs web server on :3000)
const server = await startStaticServer({ port: 3000 });
try {
  exitCode ||= await runNodeScript("tests/browser-test.js");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

process.exit(exitCode);


