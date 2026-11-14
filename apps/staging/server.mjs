// Tiny static server for local use: serves dist/ and the failing /api/orders endpoint.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "dist");
const ordersHandler = createRequire(import.meta.url)("./api/orders.js");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const port = Number(process.env.PORT ?? 4000);

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/api/orders") return ordersHandler(req, res);
  if (path.startsWith("/api/")) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    return res.end('{"error":"Not found"}');
  }
  const file = path === "/" ? "/index.html" : path;
  try {
    const target = resolve(dist, "." + file);
    if (!target.startsWith(dist)) throw new Error("forbidden");
    res.setHeader("Content-Type", types[extname(target)] ?? "application/octet-stream");
    res.end(await readFile(target));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(port, () => console.log(`Staging demo site: http://localhost:${port}`));
