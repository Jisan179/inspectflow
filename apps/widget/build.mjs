// Bundles the widget into ONE self-contained script and copies it into the
// apps that serve it (the web dashboard and the demo staging site).
import { build } from "esbuild";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, "dist/inspectflow-widget.js");

await build({
  entryPoints: [resolve(here, "src/index.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  outfile,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});

for (const app of ["web", "staging"]) {
  const dest = resolve(here, `../${app}/public/inspectflow-widget.js`);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(outfile, dest);
}
console.log(`Built ${outfile} (${Math.round(statSync(outfile).size / 1024)} KB)`);
