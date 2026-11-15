// Generates the report diagrams (use case, ER, architecture) as SVG and PNG.
// Run from anywhere:  node docs/report/diagrams.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "images");
mkdirSync(out, { recursive: true });
// sharp lives in the API package; resolve it from there.
const require = createRequire(resolve(here, "../../apps/api/package.json"));
const sharp = require("sharp");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = "Arial, Helvetica, sans-serif";
const INK = "#1f2a44";
const LINE = "#44516e";

function text(x, y, s, { size = 14, anchor = "middle", bold = false, fill = INK, italic = false } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}"${bold ? ' font-weight="bold"' : ""}${italic ? ' font-style="italic"' : ""} fill="${fill}">${esc(s)}</text>`;
}

/* ---------------- Use case diagram ---------------- */

function actor(x, y, label) {
  return `
  <g stroke="${INK}" stroke-width="2" fill="none">
    <circle cx="${x}" cy="${y}" r="14"/>
    <line x1="${x}" y1="${y + 14}" x2="${x}" y2="${y + 52}"/>
    <line x1="${x - 20}" y1="${y + 26}" x2="${x + 20}" y2="${y + 26}"/>
    <line x1="${x}" y1="${y + 52}" x2="${x - 16}" y2="${y + 80}"/>
    <line x1="${x}" y1="${y + 52}" x2="${x + 16}" y2="${y + 80}"/>
  </g>
  ${label.map((l, i) => text(x, y + 100 + i * 16, l, { size: 14, bold: true })).join("")}`;
}

function oval(cx, cy, lines, rx = 128, ry = 30) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#eef1f8" stroke="${INK}" stroke-width="1.6"/>` +
    lines.map((l, i) => text(cx, cy + 5 + (i - (lines.length - 1) / 2) * 16, l, { size: 13.5 })).join("");
}

function usecaseSvg() {
  const W = 1560, H = 1120;
  const UC = {
    signin:   [470, 120, ["Sign in"]],
    report:   [470, 215, ["Report issue via widget"]],
    capture:  [470, 320, ["Capture screenshot and", "runtime evidence"]],
    annotate: [470, 425, ["Annotate, blur,", "undo / redo"]],
    myrep:    [470, 530, ["View own reports", "and comment"]],
    verify:   [470, 635, ["Verify or reopen fix"]],
    review:   [470, 740, ["Review build, approve or", "request changes"]],
    search:   [800, 170, ["Search, filter and", "sort tickets"]],
    evidence: [800, 275, ["View technical evidence"]],
    status:   [800, 380, ["Change ticket status"]],
    link:     [800, 485, ["Link branch / pull request"]],
    regbuild: [800, 590, ["Register staging build"]],
    ready:    [800, 695, ["Mark build ready", "for review"]],
    resolve:  [800, 880, ["Auto-resolve tickets on", "merged pull request"]],
    members:  [1130, 240, ["Manage members", "and roles"]],
    settings: [1130, 345, ["Project settings and", "widget key rotation"]],
    github:   [1130, 450, ["Connect GitHub and", "webhook secret"]],
    overview: [1130, 555, ["View overview and", "audit log"]],
    verifysig:[1130, 880, ["Verify HMAC signature,", "ignore replays"]],
  };
  const A = { tester: [120, 330], dev: [120, 640], lead: [1440, 330], gh: [1440, 800] };

  const linkLine = (a, u, side = "left") => {
    const [cx, cy] = [UC[u][0], UC[u][1]];
    const x = side === "left" ? cx - 128 : cx + 128;
    return `<line x1="${a[0] + (side === "left" ? 24 : -24)}" y1="${a[1] + 40}" x2="${x}" y2="${cy}" stroke="${LINE}" stroke-width="1.4"/>`;
  };
  const include = (from, to, label = "«include»") => {
    const [x1, y1] = [UC[from][0], UC[from][1] + 30];
    const [x2, y2] = [UC[to][0], UC[to][1] - 30];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#arrow)"/>` +
      text(mx + 58, my + 4, label, { size: 12, italic: true, fill: LINE });
  };

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="${LINE}"/></marker></defs>
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="300" y="50" width="990" height="1000" rx="14" fill="none" stroke="${INK}" stroke-width="2.2"/>
  ${text(795, 84, "InspectFlow", { size: 22, bold: true })}`;

  for (const [cx, cy, lines] of Object.values(UC)) s += oval(cx, cy, lines);
  s += actor(...A.tester, ["Tester /", "Client Reviewer"]);
  s += actor(...A.dev, ["Developer"]);
  s += actor(...A.lead, ["Project Lead"]);
  // GitHub as a system actor (box)
  s += `<rect x="${A.gh[0] - 60}" y="${A.gh[1]}" width="120" height="56" fill="#eef1f8" stroke="${INK}" stroke-width="2"/>` +
    text(A.gh[0], A.gh[1] + 24, "«system»", { size: 12, italic: true }) +
    text(A.gh[0], A.gh[1] + 44, "GitHub", { size: 15, bold: true });

  for (const u of ["signin", "report", "myrep", "verify", "review"]) s += linkLine(A.tester, u, "left");
  for (const u of ["search", "evidence", "status", "link", "regbuild", "ready"]) s += linkLine(A.dev, u, "left");
  for (const u of ["members", "settings", "github", "overview"]) s += linkLine(A.lead, u, "right");
  s += `<line x1="${A.gh[0] - 60}" y1="${A.gh[1] + 28}" x2="${UC.resolve[0] + 128}" y2="${UC.resolve[1]}" stroke="${LINE}" stroke-width="1.4"/>`;
  s += `<line x1="${A.gh[0] - 60}" y1="${A.gh[1] + 40}" x2="${UC.verifysig[0] + 128}" y2="${UC.verifysig[1]}" stroke="${LINE}" stroke-width="1.4"/>`;
  s += include("report", "capture");
  s += include("capture", "annotate");
  s += `</svg>`;
  return s;
}

/* ---------------- ER diagram (crow's foot) ---------------- */

const ROW_H = 19, TITLE_H = 28, PAD = 8;

function entity(x, y, w, title, rows) {
  const h = TITLE_H + rows.length * ROW_H + PAD;
  let s = `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="white" stroke="${INK}" stroke-width="1.8"/>
  <rect x="${x}" y="${y}" width="${w}" height="${TITLE_H}" rx="6" fill="#1f2a44"/>
  <rect x="${x}" y="${y + TITLE_H - 8}" width="${w}" height="8" fill="#1f2a44"/>
  ${text(x + w / 2, y + 19, title, { size: 14.5, bold: true, fill: "white" })}`;
  rows.forEach((r, i) => {
    const bold = /^(PK|FK|PK,FK)\b/.test(r);
    s += text(x + 10, y + TITLE_H + 14 + i * ROW_H, r, { size: 12.5, anchor: "start", bold });
  });
  return { svg: s + "</g>", h };
}

// crow's foot end markers drawn perpendicular to the line direction
function endMarker(x, y, angle, kind) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);           // unit vector pointing INTO the line (away from entity)
  const px = -dy, py = dx;                            // perpendicular
  const P = (t, u) => `${(x + dx * t + px * u).toFixed(1)},${(y + dy * t + py * u).toFixed(1)}`;
  let m = "";
  if (kind.includes("many")) {
    m += `<line x1="${x}" y1="${y}" x2="${P(14, -8).split(",")[0]}" y2="${P(14, -8).split(",")[1]}" />`;
    m += `<line x1="${x}" y1="${y}" x2="${P(14, 8).split(",")[0]}" y2="${P(14, 8).split(",")[1]}" />`;
    m += `<line x1="${x}" y1="${y}" x2="${P(14, 0).split(",")[0]}" y2="${P(14, 0).split(",")[1]}" />`;
  } else {
    // one: single tick
    m += `<line x1="${P(10, -7).split(",")[0]}" y1="${P(10, -7).split(",")[1]}" x2="${P(10, 7).split(",")[0]}" y2="${P(10, 7).split(",")[1]}" />`;
  }
  if (kind.includes("mand")) {
    m += `<line x1="${P(18, -7).split(",")[0]}" y1="${P(18, -7).split(",")[1]}" x2="${P(18, 7).split(",")[0]}" y2="${P(18, 7).split(",")[1]}" />`;
  }
  if (kind.includes("opt")) {
    const c = P(22, 0).split(",");
    m += `<circle cx="${c[0]}" cy="${c[1]}" r="5" fill="white"/>`;
  }
  return `<g stroke="${LINE}" stroke-width="1.6" fill="none">${m}</g>`;
}

function rel(x1, y1, a1, k1, x2, y2, a2, k2, label, lx, ly) {
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="1.5"/>`;
  s += endMarker(x1, y1, a1, k1) + endMarker(x2, y2, a2, k2);
  if (label) s += text(lx ?? (x1 + x2) / 2, ly ?? (y1 + y2) / 2 - 6, label, { size: 12, italic: true, fill: LINE });
  return s;
}

function erSvg() {
  const W = 1560, H = 1240;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="white"/>`;
  const E = {};
  const put = (key, x, y, w, title, rows) => { const e = entity(x, y, w, title, rows); E[key] = { x, y, w, h: e.h }; s += e.svg; };

  put("user", 60, 60, 250, "User", ["PK  id (uuid)", "    name", "UK  email", "    passwordHash (bcrypt)", "    createdAt"]);
  put("refresh", 60, 290, 250, "RefreshToken", ["PK  id", "FK  userId", "UK  tokenHash", "    expiresAt, revokedAt"]);
  put("project", 620, 60, 290, "Project", ["PK  id (uuid)", "    name, stagingUrl", "UK  apiKeyPrefix   (key hash stored)", "    allowedOrigins[]", "UK  githubRepo", "    webhookSecret", "    nextTicketNo"]);
  put("webhook", 1210, 60, 290, "WebhookDelivery", ["PK  id", "FK  projectId", "UK  deliveryId  (replay guard)", "    event, signatureValid", "    outcome, processedAt"]);
  put("membership", 340, 330, 250, "Membership", ["PK  id", "FK  userId", "FK  projectId", "    role (LEAD / DEVELOPER /", "          TESTER_CLIENT)", "UK  (userId, projectId)"]);
  put("build", 950, 330, 260, "Build", ["PK  id", "FK  projectId", "    name, branch", "    commitSha", "    previewUrl", "    status (DRAFT / IN_REVIEW /", "            APPROVED / REJECTED)"]);
  put("approval", 1260, 620, 260, "BuildApproval", ["PK  id", "FK  buildId", "FK  userId  (the client)", "    decision, note", "    commitSha  (frozen)", "    decidedAt"]);
  put("ticket", 560, 620, 330, "Ticket", ["PK  id", "FK  projectId      UK (projectId, number)", "FK  buildId (nullable)", "FK  reporterId,  FK assigneeId (null)", "FK  duplicateOfId (self, nullable)", "    title, description, severity", "    status (OPEN / IN_PROGRESS /", "            RESOLVED / VERIFIED)", "    pageUrl, viewport, userAgent", "    branch, prNumber, resolvedAt"]);
  put("annotation", 60, 980, 240, "Annotation", ["PK  id", "FK  ticketId", "    type (ARROW/BOX/BLUR)", "    shapeJson"]);
  put("artifact", 340, 980, 250, "Artifact", ["PK  id", "FK  ticketId", "    kind (SCREENSHOT)", "UK  storageKey", "    mimeType, sizeBytes"]);
  put("event", 630, 980, 270, "CapturedEvent", ["PK  id", "FK  ticketId", "    type (CONSOLE/NETWORK/ERROR)", "    method, url, statusCode", "    message, stack, timestamp"]);
  put("comment", 940, 980, 240, "Comment", ["PK  id", "FK  ticketId", "FK  authorId", "    body, createdAt"]);
  put("activity", 1220, 980, 280, "ActivityLog", ["PK  id", "FK  projectId", "FK  ticketId (nullable)", "FK  actorId (nullable)", "    action, metadata(json)", "    createdAt"]);

  const C = (k, side, frac = 0.5) => {
    const e = E[k];
    if (side === "r") return [e.x + e.w, e.y + e.h * frac, 0];
    if (side === "l") return [e.x, e.y + e.h * frac, 180];
    if (side === "t") return [e.x + e.w * frac, e.y, 270];
    return [e.x + e.w * frac, e.y + e.h, 90];
  };
  const R = (ka, sa, fa, kinda, kb, sb, fb, kindb, label) => {
    const [x1, y1, a1] = C(ka, sa, fa);
    const [x2, y2, a2] = C(kb, sb, fb);
    s += rel(x1, y1, a1, kinda, x2, y2, a2, kindb, label);
  };

  R("user", "b", 0.25, "one mand", "refresh", "t", 0.5, "many opt", "");
  R("user", "r", 0.3, "one mand", "membership", "t", 0.3, "many opt", "has");
  R("project", "b", 0.15, "one mand", "membership", "t", 0.8, "many opt", "");
  R("project", "r", 0.5, "one mand", "webhook", "l", 0.5, "many opt", "receives");
  R("project", "b", 0.75, "one mand", "build", "t", 0.4, "many opt", "owns");
  R("project", "b", 0.45, "one mand", "ticket", "t", 0.35, "many opt", "owns");
  R("build", "b", 0.3, "one opt", "ticket", "t", 0.8, "many opt", "groups");
  R("build", "r", 0.7, "one mand", "approval", "t", 0.4, "many opt", "decided by");
  R("ticket", "b", 0.1, "one mand", "annotation", "t", 0.6, "many opt", "");
  R("ticket", "b", 0.3, "one mand", "artifact", "t", 0.5, "many opt", "");
  R("ticket", "b", 0.55, "one mand", "event", "t", 0.5, "many opt", "");
  R("ticket", "b", 0.85, "one mand", "comment", "t", 0.4, "many opt", "");
  R("ticket", "r", 0.75, "one opt", "activity", "l", 0.35, "many opt", "history");
  // self relation duplicateOf
  const t = E.ticket;
  s += `<path d="M ${t.x + 40} ${t.y + t.h} v 26 h -70 v -60 h 30" fill="none" stroke="${LINE}" stroke-width="1.5"/>`;
  s += endMarker(t.x + 40, t.y + t.h, 90, "many opt") + endMarker(t.x, t.y + t.h - 34, 180, "one opt");
  s += text(t.x - 36, t.y + t.h + 18, "duplicate of", { size: 12, italic: true, fill: LINE });
  s += `</svg>`;
  return s;
}

/* ---------------- Architecture diagram ---------------- */

function archSvg() {
  const W = 1400, H = 620;
  const box = (x, y, w, h, title, lines, fill = "#eef1f8") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${INK}" stroke-width="2"/>` +
    text(x + w / 2, y + 26, title, { size: 16, bold: true }) +
    lines.map((l, i) => text(x + w / 2, y + 48 + i * 18, l, { size: 13 })).join("");
  const arrow = (x1, y1, x2, y2, label, ly = -8, dash = false) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="2"${dash ? ' stroke-dasharray="7 5"' : ""} marker-end="url(#arr)"/>` +
    (label ? text((x1 + x2) / 2, (y1 + y2) / 2 + ly, label, { size: 12.5, italic: true, fill: LINE }) : "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><marker id="arr" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto"><path d="M0,0 L11,4.5 L0,9 z" fill="${LINE}"/></marker></defs>
  <rect width="${W}" height="${H}" fill="white"/>
  ${box(40, 60, 330, 120, "Staging website", ["(customer's site under test)", "Embedded InspectFlow widget:", "html2canvas capture, Konva editor,", "rolling evidence buffer"])}
  ${box(40, 300, 330, 100, "Dashboard", ["Next.js + React (Vercel)", "Lead / Developer / Tester views", "JWT access + refresh tokens"])}
  ${box(530, 150, 360, 190, "NestJS REST API (Render)", ["Passport-JWT  ·  project-role guards", "class-validator DTOs  ·  Helmet  ·  CORS", "widget key + origin checks  ·  rate limits", "evidence sanitisation  ·  Sharp re-encode", "Swagger /api/docs  ·  /health"])}
  ${box(1030, 60, 320, 100, "PostgreSQL (Supabase)", ["Prisma ORM, migrations,", "transactions and row locks"])}
  ${box(1030, 230, 320, 100, "Private object storage", ["S3-compatible bucket (Supabase)", "screenshots, short-lived signed URLs"])}
  ${box(1030, 420, 320, 90, "GitHub", ["pull_request webhook", "X-Hub-Signature-256 (HMAC)"], "#fff4d6")}
  ${arrow(370, 120, 530, 200, "HTTPS: project key + origin + widget token")}
  ${arrow(370, 350, 530, 290, "HTTPS: Bearer JWT")}
  ${arrow(890, 200, 1030, 120, "SQL (Prisma)")}
  ${arrow(890, 280, 1030, 280, "put / delete")}
  ${arrow(1030, 465, 890, 320, "merged PR event, HMAC verified")}
  <path d="M 1350 280 L 1386 280 L 1386 580 L 300 580 L 300 410" fill="none" stroke="${LINE}" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#arr)"/>
  ${text(705, 568, "browser loads screenshots directly via expiring signed URLs", { size: 12.5, italic: true, fill: LINE })}
</svg>`;
}

/* ---------------- State diagrams (ticket + build) ---------------- */

function stateSvg() {
  const W = 1500, H = 760;
  const st = (x, y, w, h, label, fill = "#eef1f8") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${fill}" stroke="${INK}" stroke-width="2"/>` +
    text(x + w / 2, y + h / 2 + 5, label, { size: 17, bold: true });
  const arr = (d, label, lx, ly, dash = false) =>
    `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="2"${dash ? ' stroke-dasharray="7 5"' : ""} marker-end="url(#a)"/>` +
    `<rect x="${lx - label.length * 3.4 - 6}" y="${ly - 14}" width="${label.length * 6.8 + 12}" height="20" fill="white"/>` + text(lx, ly, label, { size: 13, italic: true, fill: LINE });
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><marker id="a" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto"><path d="M0,0 L11,4.5 L0,9 z" fill="${LINE}"/></marker></defs>
  <rect width="${W}" height="${H}" fill="white"/>
  ${text(750, 40, "Ticket lifecycle", { size: 20, bold: true })}`;
  // ticket states
  s += `<circle cx="60" cy="150" r="9" fill="${INK}"/>`;
  s += st(130, 120, 190, 60, "OPEN") + st(450, 120, 190, 60, "IN_PROGRESS") + st(790, 120, 190, 60, "RESOLVED") + st(1130, 120, 190, 60, "VERIFIED", "#e4f6ea");
  s += arr("M 69 150 L 130 150", "created", 100, 138);
  s += arr("M 320 140 L 450 140", "start work", 385, 128);
  s += arr("M 640 140 L 790 140", "resolve", 715, 128);
  s += arr("M 980 140 L 1130 140", "verify fix", 1055, 128);
  s += text(385, 106, "Developer / Lead", { size: 12, fill: INK });
  s += text(715, 106, "Developer / Lead, or merged PR (GitHub)", { size: 12, fill: INK });
  s += text(1055, 106, "Tester / Client, Lead", { size: 12, fill: INK });
  // reopen paths below
  s += arr("M 885 180 C 885 320 225 320 225 180", "reopen (Tester / Client, Lead)", 555, 284, true);
  s += arr("M 1225 180 C 1225 420 175 420 175 180", "reopen a verified ticket (Tester / Client, Lead)", 700, 349, true);
  s += arr("M 545 180 C 545 250 280 250 280 180", "back to Open (Developer / Lead)", 410, 225, true);
  s += text(750, 395, "Open and In progress High / Blocker tickets block build approval until they are Verified.", { size: 14, italic: true, fill: LINE });
  // build states
  s += text(750, 450, "Build lifecycle and client sign-off", { size: 20, bold: true });
  s += `<circle cx="60" cy="570" r="9" fill="${INK}"/>`;
  s += st(130, 540, 190, 60, "DRAFT") + st(520, 540, 220, 60, "IN_REVIEW") + st(1040, 490, 220, 60, "APPROVED", "#e4f6ea") + st(1040, 620, 260, 60, "REJECTED", "#fdecec");
  s += arr("M 69 570 L 130 570", "registered", 100, 558);
  s += arr("M 320 570 L 520 570", "mark ready for review", 420, 558);
  s += text(420, 530, "Developer / Lead", { size: 12, fill: INK });
  s += arr("M 740 560 L 1040 520", "approve (no blocking tickets)", 890, 520);
  s += text(890, 497, "Tester / Client; commit SHA recorded", { size: 12, fill: INK });
  s += arr("M 740 585 L 1040 645", "request changes (note required)", 890, 640);
  s += text(890, 668, "Tester / Client; commit SHA recorded", { size: 12, fill: INK });
  s += text(750, 730, "A decided build cannot be decided again (409). Concurrent decisions are serialised with SELECT ... FOR UPDATE.", { size: 14, italic: true, fill: LINE });
  return s + "</svg>";
}

/* ---------------- Sequence diagram: report to approval ---------------- */

function seqSvg() {
  const names = ["Tester", "Widget", "API", "PostgreSQL / Storage", "Developer", "GitHub", "Client"];
  const X = [90, 270, 480, 700, 940, 1130, 1320];
  const W = 1440, top = 80;
  const msgs = [
    [0, 1, "1  click Report issue, sign in"],
    [1, 2, "2  POST /widget/login (project key + origin)"],
    [2, 1, "3  widget token (2 h, one project)", true],
    [1, 1, "4  capture page, collected errors; blur + flatten image"],
    [1, 2, "5  POST /reports (screenshot + evidence)"],
    [2, 3, "6  validate, sanitise, store PNG, create ticket (one transaction)"],
    [4, 2, "7  open ticket, link branch (Bearer JWT)"],
    [5, 2, "8  pull_request merged, X-Hub-Signature-256"],
    [2, 3, "9  verify HMAC, insert delivery id, ticket to Resolved (one transaction)"],
    [0, 2, "10 verify the fix"],
    [6, 2, "11 approve build (blocked while High/Blocker tickets are unverified)"],
    [2, 3, "12 lock build row, store approval with commit SHA"],
  ];
  const H = top + 70 + msgs.length * 50 + 40;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><marker id="m" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto"><path d="M0,0 L11,4.5 L0,9 z" fill="${LINE}"/></marker></defs>
  <rect width="${W}" height="${H}" fill="white"/>`;
  names.forEach((n, i) => {
    s += `<rect x="${X[i] - 75}" y="30" width="150" height="40" rx="8" fill="#1f2a44"/>` + text(X[i], 56, n, { size: 14, bold: true, fill: "white" });
    s += `<line x1="${X[i]}" y1="70" x2="${X[i]}" y2="${H - 20}" stroke="#9aa6c4" stroke-width="1.5" stroke-dasharray="6 5"/>`;
  });
  msgs.forEach(([a, b, label, dashed], i) => {
    const y = top + 50 + i * 50;
    if (a === b) {
      s += `<path d="M ${X[a]} ${y - 14} h 56 v 28 h -56" fill="none" stroke="${LINE}" stroke-width="1.8" marker-end="url(#m)"/>` + text(X[a] + 66, y + 4, label, { size: 13, anchor: "start" });
    } else {
      s += `<line x1="${X[a]}" y1="${y}" x2="${X[b]}" y2="${y}" stroke="${LINE}" stroke-width="1.8"${dashed ? ' stroke-dasharray="7 5"' : ""} marker-end="url(#m)"/>`;
      const mid = (X[a] + X[b]) / 2;
      s += text(mid, y - 8, label, { size: 13 });
    }
  });
  return s + "</svg>";
}

/* ---------------- render ---------------- */

const jobs = [
  ["usecase", usecaseSvg()],
  ["er", erSvg()],
  ["architecture", archSvg()],
  ["states", stateSvg()],
  ["sequence", seqSvg()],
];
for (const [name, svg] of jobs) {
  writeFileSync(resolve(out, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(resolve(out, `${name}.png`));
  console.log("wrote", name + ".png");
}
