// Renders the captured terminal text files as terminal-style PNG images.
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../apps/api/package.json"));
const sharp = require("sharp");
const dir = resolve(here, "images/term");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const f of readdirSync(dir).filter((n) => n.endsWith(".txt"))) {
  const lines = readFileSync(resolve(dir, f), "utf8").replace(/\r/g, "").split("\n");
  const LH = 26, FS = 18, PADX = 22, PADT = 56, CW = 10.8;
  const width = Math.max(760, Math.ceil(Math.max(...lines.map((l) => l.length)) * CW) + PADX * 2);
  const height = PADT + lines.length * LH + 24;
  const text = lines
    .map((l, i) => {
      let fill = "#d6deeb";
      if (l.startsWith("$")) fill = "#7fdbca";
      else if (/PASS/.test(l)) fill = "#addb67";
      else if (/FAIL|Error/.test(l)) fill = "#ff5874";
      else if (/^(Tests|Test Suites):/.test(l)) fill = "#ecc48d";
      return `<text x="${PADX}" y="${PADT + i * LH}" font-family="Consolas, 'Courier New', monospace" font-size="${FS}" fill="${fill}" xml:space="preserve">${esc(l)}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" rx="10" fill="#011627"/>
    <rect width="${width}" height="34" rx="10" fill="#1d3b53"/><rect y="20" width="${width}" height="14" fill="#1d3b53"/>
    <circle cx="20" cy="17" r="6" fill="#ff5f56"/><circle cx="40" cy="17" r="6" fill="#ffbd2e"/><circle cx="60" cy="17" r="6" fill="#27c93f"/>
    <text x="${width / 2}" y="22" text-anchor="middle" font-family="Arial" font-size="13" fill="#9fb3c8">Terminal</text>
    ${text}</svg>`;
  const out = resolve(dir, f.replace(".txt", ".png"));
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(out);
  console.log("wrote", out);
}
