// Copies the captured screenshots into docs/report/images/shots with report names.
// Postman shots are cropped to the request + response area (no sidebar).
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../apps/api/package.json"));
const sharp = require("sharp");
const out = resolve(here, "images/shots");
mkdirSync(out, { recursive: true });
const TR = "C:/Users/jisan/.claude/projects/E--Personal-Project/16fa8626-c776-42c3-b6d0-f40de704f249/tool-results/";

const postman = {
  "p01-register-201": "mcp-computer-use-blob-1794711434555-4ac6ah.jpg",
  "p02-register-409": "mcp-computer-use-blob-1794711411633-dkce4z.jpg",
  "p03-register-400": "mcp-computer-use-blob-1794711448621-q5uv52.jpg",
  "p04-login-200": "mcp-computer-use-blob-1794711487581-7uggas.jpg",
  "p05-projects-401": "mcp-computer-use-blob-1794711473623-8ck3ei.jpg",
  "p06-tickets-search-200": "mcp-computer-use-blob-1794711494817-a37gju.jpg",
  "p07-tester-patch-403": "mcp-computer-use-blob-1794711508494-a6gs4e.jpg",
  "p08-status-201": "mcp-computer-use-blob-1794711524078-l0y5we.jpg",
  "p09-approve-409": "mcp-computer-use-blob-1794711531314-dipe3l.jpg",
  "p10-webhook-401": "mcp-computer-use-blob-1794711546252-iry2a1.jpg",
  "p11-widget-403": "mcp-computer-use-blob-1794711553496-c6aflh.jpg",
};
for (const [name, file] of Object.entries(postman)) {
  const img = sharp(TR + file);
  const { width, height } = await img.metadata();
  // crop: x 356..1420, y 62..780 on a 1456x819 frame (scale if the file differs)
  const s = width / 1456;
  await img
    .extract({ left: Math.round(356 * s), top: Math.round(62 * s), width: Math.round(1064 * s), height: Math.round(718 * s) })
    .png()
    .toFile(resolve(out, name + ".png"));
  console.log("wrote", name);
}

// Dashboard screenshots taken earlier against the real running stack
const dash = {
  "d01-tickets-list": "mcp-Claude_Browser-blob-1794655340789-1srm57.jpg",
  "d02-ticket-detail": "mcp-Claude_Browser-blob-1794655350444-kgiazp.jpg",
  "d03-evidence": "mcp-Claude_Browser-blob-1794655358654-qz3sux.jpg",
  "d04-build-approved": "mcp-Claude_Browser-blob-1794655399777-69if3n.jpg",
  "d05-build-mobile": "mcp-Claude_Browser-blob-1794655403311-0cqbko.jpg",
};
for (const [name, file] of Object.entries(dash)) {
  copyFileSync(TR + file, resolve(out, name + ".jpg"));
  console.log("copied", name);
}
