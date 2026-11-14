// Builds the static demo site into dist/, injecting the public widget key and API URL.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "dist");
mkdirSync(out, { recursive: true });

const WIDGET_KEY = process.env.WIDGET_KEY ?? "if_pk_demo_acme_staging_key_0001";
const API_URL = (process.env.API_URL ?? "http://localhost:5001").replace(/\/+$/, "");

const html = readFileSync(resolve(here, "src/index.html"), "utf8")
  .replaceAll("{{WIDGET_KEY}}", WIDGET_KEY)
  .replaceAll("{{API_URL}}", API_URL);
writeFileSync(resolve(out, "index.html"), html);
for (const f of ["app.js", "styles.css"]) copyFileSync(resolve(here, "src", f), resolve(out, f));

const widget = resolve(here, "public/inspectflow-widget.js");
if (!existsSync(widget)) {
  console.error("Widget bundle missing. Run: pnpm --filter @inspectflow/widget build");
  process.exit(1);
}
copyFileSync(widget, resolve(out, "inspectflow-widget.js"));
console.log(`Staging site built (key ${WIDGET_KEY.slice(0, 14)}..., api ${API_URL})`);
