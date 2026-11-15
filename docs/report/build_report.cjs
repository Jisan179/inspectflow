// Builds InspectFlow_Project_Report.docx following the CSC4161 sample report (LibraSync).
//   cd docs/report/tools && npm install   (once)   then   node ../build_report.cjs
const fs = require("fs");
const path = require("path");
const docx = require(path.join(__dirname, "tools/node_modules/docx"));
const sharp = require(path.join(__dirname, "../../apps/api/node_modules/sharp"));
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, BorderStyle, PageBreak, LevelFormat, Footer, Header, PageNumber,
  PageOrientation, TableOfContents, VerticalAlign,
} = docx;

const IMG = path.join(__dirname, "images");
const FONT = "Arial";
const INK = "1F2A44";
const A4 = { w: 11906, h: 16838 };
const MARGIN = 1134; // 2 cm
const PORTRAIT_W = A4.w - 2 * MARGIN; // 9638 dxa
const LAND_W = A4.h - 2 * 850;

// ---------- helpers ----------
const run = (t, o = {}) => new TextRun({ text: t, font: FONT, size: 21, ...o });
const ph = (t) => new TextRun({ text: t, font: FONT, size: 21, highlight: "yellow" }); // placeholder to fill

/** Inline markup: **bold**, `code`, [[placeholder]] */
function rich(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(run(text.slice(last, m.index), base));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(run(tok.slice(2, -2), { ...base, bold: true }));
    else if (tok.startsWith("`")) out.push(new TextRun({ text: tok.slice(1, -1), font: "Consolas", size: 19, shading: { type: ShadingType.CLEAR, fill: "EEF1F8" }, ...base.color ? { color: base.color } : {} }));
    else out.push(ph("[" + tok.slice(2, -2) + "]"));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(run(text.slice(last), base));
  return out;
}
const P = (text, o = {}) => new Paragraph({ children: rich(text, o.run), spacing: { after: 120, line: 276 }, alignment: o.align, keepNext: o.keepNext, ...o.para });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })], pageBreakBefore: true });
const H1n = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, font: FONT })] });
const bullet = (t) => new Paragraph({ numbering: { reference: "bul", level: 0 }, children: rich(t), spacing: { after: 60, line: 264 } });
const num = (t, ref = "num") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: rich(t), spacing: { after: 60, line: 264 } });
const spacer = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "B9C2D6" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function table(headers, rows, widths, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const mk = (text, w, head, shade) =>
    new TableCell({
      borders,
      width: { size: w, type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, fill: INK } : shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      verticalAlign: VerticalAlign.TOP,
      children: String(text).split("\n").map((line) =>
        new Paragraph({ spacing: { after: 20, line: 240 }, children: rich(line, head ? { bold: true, color: "FFFFFF", size: 19 } : { size: o.size ?? 19 }) })),
    });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => mk(h, widths[i], true)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, widths[i], false, ri % 2 ? "F5F7FC" : undefined)) })),
    ],
  });
}

/** Two-column key/value table (no header row) */
function kv(rows, widths = [2400, PORTRAIT_W - 2400]) {
  return new Table({
    width: { size: widths[0] + widths[1], type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(([k, v]) => new TableRow({ cantSplit: true, children: [
      new TableCell({ borders, width: { size: widths[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "EEF1F8" }, margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: [new Paragraph({ spacing: { after: 20 }, children: [run(k, { bold: true, size: 19 })] })] }),
      new TableCell({ borders, width: { size: widths[1], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: String(v).split("\n").map((l) => new Paragraph({ spacing: { after: 20, line: 240 }, children: rich(l, { size: 19 }) })) }),
    ] })),
  });
}

function code(text) {
  const lines = text.replace(/\n$/, "").split("\n");
  return new Table({
    width: { size: PORTRAIT_W, type: WidthType.DXA },
    columnWidths: [PORTRAIT_W],
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: cellBorder, bottom: cellBorder, left: { style: BorderStyle.SINGLE, size: 18, color: "3B6CF6" }, right: cellBorder },
      width: { size: PORTRAIT_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: "F4F6FB" },
      margins: { top: 80, bottom: 80, left: 140, right: 100 },
      children: lines.map((l) => new Paragraph({ spacing: { after: 0, line: 232 }, children: [new TextRun({ text: l === "" ? " " : l, font: "Consolas", size: 17 })] })),
    })] })],
  });
}

const meta = {};
async function imgInfo(file) {
  if (!meta[file]) meta[file] = await sharp(file).metadata();
  return meta[file];
}
async function figure(file, caption, maxW = 600, maxH = 720) {
  const full = path.isAbsolute(file) ? file : path.join(IMG, file);
  const { width, height } = await imgInfo(full);
  let w = maxW, h = (height * w) / width;
  if (h > maxH) { h = maxH; w = (width * h) / height; }
  const ext = path.extname(full).slice(1).toLowerCase();
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 }, children: [
      new ImageRun({ type: ext === "jpg" ? "jpg" : "png", data: fs.readFileSync(full), transformation: { width: Math.round(w), height: Math.round(h) }, altText: { title: caption, description: caption, name: path.basename(full) } }),
    ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(caption, { italics: true, size: 18, color: "44516E" })] }),
  ];
}

// =====================================================================
// CONTENT
// =====================================================================
const cover = [];
cover.push(new Paragraph({ spacing: { before: 600, after: 80 }, alignment: AlignmentType.CENTER, children: [ph("[University name]"), run("   |   Department of Computer Science", { size: 22 })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [run("CSC4161   |   Advance Programming in Web Technology", { size: 22 })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run("Project Report", { size: 30, color: "44516E" })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run("InspectFlow", { size: 72, bold: true, color: INK })] }));
cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [run("Visual Staging QA, Bug Annotation and PR Sign-Off Hub", { size: 30, color: "44516E" })] }));
cover.push(P("**Group information**", { para: { spacing: { after: 80 } } }));
cover.push(kv([
  ["Group number", "[[group number]]"],
  ["Semester", "[[semester, for example Fall 2026]]"],
  ["Submitted to", "[[faculty name and designation]]"],
  ["Submission date", "[[date of submission]]"],
  ["Live system", "Dashboard: https://inspectflow-web-seven.vercel.app\nDemo staging site: https://inspectflow-staging.vercel.app\nAPI and Swagger: https://inspectflow-api.onrender.com/api/docs"],
  ["Source code", "https://github.com/Jisan179/inspectflow (private; access on request)"],
]));
cover.push(spacer(200));
cover.push(P("**Group members, contribution and AI usage**", { para: { spacing: { after: 80 } } }));
cover.push(table(
  ["SL", "Student ID", "Name", "Section", "Contribution", "AI usage"],
  [
    ["1", "22-48674-3", "MD Jisan Ahmmed Jim", "[[section]]", "[[Write your real contribution, for example: widget, annotation editor, GitHub webhook, approval workflow, deployment, report]]", "[[% of your own work]]"],
    ["2", "[[ID]]", "[[name]]", "[[section]]", "[[contribution]]", "[[%]]"],
    ["3", "[[ID]]", "[[name]]", "[[section]]", "[[contribution]]", "[[%]]"],
    ["4", "[[ID]]", "[[name]]", "[[section]]", "[[contribution]]", "[[%]]"],
  ],
  [500, 1300, 1900, 1000, 3738, 1200], { size: 18 }));
cover.push(spacer(80));
cover.push(P("AI usage is each member's own estimate of the share of their work (code, diagrams, report text) drafted or generated with an AI tool. **Tools used: Claude Code (Anthropic) was used to draft and test source code, diagrams and report text; every generated part was read, run and checked by the submitting member.** [[Edit this sentence and the percentages to match what actually happened in your group, and follow your instructor's AI policy. Every member must be able to explain every module.]]", { run: { size: 18 } }));

const toc = [
  new Paragraph({ children: [new TextRun({ text: "Contents", font: FONT, bold: true, size: 32, color: INK })], spacing: { after: 200 } }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
];

async function bodyPart1() {
  const c = [];
  // ------------------------------------------------ 1. Background
  c.push(H1("1. Background study"));
  c.push(H2("1.1 Project overview and objectives"));
  c.push(P("InspectFlow is a web-based quality-assurance platform for web agencies, freelancers and student project teams. A client or non-technical tester opens a staging website, clicks a **Report issue** button, draws on a screenshot and sends it. The platform attaches the technical evidence that a developer needs to reproduce the problem: the page address, browser, screen size, console errors, uncaught exceptions and failed network requests. The resulting ticket is linked to a Git branch and pull request, resolves itself when GitHub reports that the pull request was merged, and finally the client approves a specific build. The approval is stored together with the commit and the time."));
  c.push(P("The project has five objectives, each with a way to check it (taken from the approved proposal):", { keepNext: true }));
  c.push(num("**Widget capture.** An embeddable widget records viewport, user agent, console errors and failed fetch and XHR requests and submits them with a screenshot. Checked on a sample staging site: every field appears on the ticket without manual entry (Chapter 6, Figure 6.20).", "obj"));
  c.push(num("**Annotation and redaction.** A Konva-based editor offers arrows, boxes and blur. Checked by submitting a blurred region and inspecting the stored image: the original pixels are gone (Section 7.3).", "obj"));
  c.push(num("**Lifecycle and roles.** Tickets follow Open, In progress, Resolved, Verified with role-based permissions, and a user cannot read another project's data. Checked by automated API tests (Figures 6.5, 6.6 and 6.17).", "obj"));
  c.push(num("**GitHub integration.** Merging a linked pull request resolves the ticket, and a request with an invalid signature is rejected with 401. Checked with signed webhook requests (Figure 6.12).", "obj"));
  c.push(num("**Build sign-off and safe data handling.** A client approves only builds shared with them, approval is blocked while blocking tickets exist, tokens and cookies are removed from stored logs and invalid files are rejected (Figures 6.11, 6.13).", "obj"));
  c.push(P("The scope of this report is the whole product: the REST API (NestJS), the dashboard (Next.js), the embeddable widget and a demonstration staging website. Video recordings, Jira or Slack synchronisation, extra roles, native mobile apps, billing and automatic root-cause analysis are outside the scope."));

  c.push(H2("1.2 Problem domain"));
  c.push(P("Small agencies and student teams test client websites on a staging server before launch. When a non-technical person finds a defect, the report usually arrives as a WhatsApp or Messenger message such as \"checkout is not working\", maybe with a phone screenshot. Three problems follow again and again:"));
  c.push(bullet("**The report cannot be reproduced.** It lacks the page address, browser, screen size, console errors and the failing request. In the example from the proposal, the real cause is a 500 response from a payment API on a 360-pixel-wide mobile browser, and it takes several messages to find that out."));
  c.push(bullet("**Professional trackers are too technical for clients.** Jira and GitHub Issues need a long form and technical vocabulary, so clients avoid them."));
  c.push(bullet("**Approval is informal.** A client says \"looks fine\", and later nobody can prove which version was accepted."));
  c.push(P("InspectFlow attacks these three problems. Evidence is captured by software, so the tester only has to point at the problem. The ticket is tied to the code change that fixes it. Approval is stored against an exact commit."));

  c.push(H2("1.3 Existing solutions"));
  c.push(table(["Approach", "Strengths", "Gaps for a small team"], [
    ["WhatsApp, Messenger or e-mail", "Fast, everybody already uses it", "Unstructured; no browser details, no status, no link to code, no audit trail"],
    ["Jira or GitHub Issues", "Structured, powerful workflows, linked to code", "Too technical for clients; a report is a long form; no automatic screenshot or console capture"],
    ["Marker.io, BugHerd, Userback", "Visual feedback widget, annotation, automatic browser context, many integrations", "Paid per seat or per plan; push issues into another tracker; not built around formal client build sign-off; not self-hostable"],
    ["InspectFlow (this project)", "Widget with real technical evidence, native tickets and roles, GitHub auto-resolve, commit-level build approval, free and self-hostable", "No session replay, no e-mail notifications, no third-party tracker sync (out of scope)"],
  ], [2300, 3700, 3638]));
  c.push(P("Marker.io was studied only for product and interface inspiration (floating report button, annotation view, readable technical details). No code, text, logo or graphic from it is used; the interface, branding and artwork are original."));

  c.push(H2("1.4 Technology study"));
  c.push(table(["Technology", "Role in InspectFlow", "Why it was chosen"], [
    ["NestJS 11 (TypeScript, Express)", "REST API framework", "Modules, dependency injection, guards, pipes and interceptors map directly onto the course topics; same structure as the instructor's user-management project"],
    ["PostgreSQL 17", "Relational database", "Transactions, row locks (SELECT ... FOR UPDATE), unique and foreign-key constraints"],
    ["Prisma 6", "ORM and migrations", "Specified in the proposal; typed queries, interactive transactions, versioned migrations (see Section 8 on the TypeORM difference)"],
    ["JWT with Passport (passport-jwt)", "Authentication", "Stateless access tokens; the strategy verifies signature and expiry on every request"],
    ["bcrypt", "Password hashing", "Slow salted hash; required by the proposal and the project guide (cost factor 12)"],
    ["class-validator, class-transformer", "DTO validation", "Rules declared on the DTO class and enforced by a global ValidationPipe that strips unknown fields"],
    ["@nestjs/swagger", "API documentation", "Interactive documentation generated from the code at /api/docs"],
    ["@nestjs/throttler, Helmet, CORS", "Abuse and browser protection", "Rate limits on login and widget routes; security headers; per-origin CORS rules"],
    ["Sharp, Multer", "Image validation and upload", "Re-encodes screenshots to PNG, checks magic bytes and size"],
    ["S3-compatible storage (Supabase)", "Private screenshot storage", "Private bucket; the browser only gets short-lived signed URLs"],
    ["Next.js 15, React 19, Tailwind CSS 4, SWR, Zod", "Dashboard", "Server-rendered routes, accessible components, client-side form validation"],
    ["html2canvas, Konva, TypeScript, esbuild", "Embeddable widget", "Page screenshot, drawing interface, one self-contained script file"],
    ["Jest, Supertest", "Testing", "Unit tests, integration tests against a real PostgreSQL, widget tests in jsdom"],
    ["Vercel, Render, Supabase", "Free hosting", "Dashboard and demo site on Vercel, API on Render, PostgreSQL and storage on Supabase"],
  ], [2600, 2300, 4738]));

  c.push(H2("1.5 Key concepts"));
  c.push(H3("JWT authentication flow"));
  c.push(num("The client sends email and password to `POST /auth/login`, validated by `LoginDto`.", "jwt"));
  c.push(num("`AuthService` loads the user and runs `bcrypt.compare`. An unknown email and a wrong password return the same 401 text, so nobody can learn which emails exist.", "jwt"));
  c.push(num("The service signs a 15-minute access token (`sub`, `email`) and a random refresh token. Only the SHA-256 hash of the refresh token is stored.", "jwt"));
  c.push(num("The client sends `Authorization: Bearer <token>`. The global `JwtGuard` runs Passport's strategy, which verifies signature and expiry and loads the user. A missing or bad token gives 401.", "jwt"));
  c.push(num("`ProjectRolesGuard` checks the user's membership in the project of the route. A non-member gets 404 (existence is not revealed) and a member with the wrong role gets 403.", "jwt"));
  c.push(H3("Per-project authorization"));
  c.push(P("InspectFlow has no global administrator role. A user's rights come from the `Membership` row that links the user to one project, with the role LEAD, DEVELOPER or TESTER_CLIENT. The same person can be Lead in one project and Tester in another."));
  c.push(H3("What the widget captures, and what it never captures"));
  c.push(P("A rolling buffer of the last 100 events keeps console errors, uncaught exceptions, unhandled promise rejections and failed fetch and XHR calls. For each failed request only the method, address (with sensitive query values removed), status code and duration are stored. Request and response headers, bodies, cookies and storage are never recorded. The tester is told this before sending."));
  c.push(H3("Why transactions matter here"));
  c.push(P("Creating a ticket changes several tables at once: the project's ticket counter, the ticket, its evidence rows, its annotations, its screenshot record and the activity log. If one step failed after another succeeded, a ticket would exist without its evidence or a number would be skipped. A transaction makes the group atomic: all changes are saved or none. The same applies to build approval and to webhook processing."));

  // ------------------------------------------------ 2. Requirements
  c.push(H1("2. Requirement analysis"));
  c.push(H2("2.1 Functional requirements"));
  const fr = [
    ["FR-01", "A visitor can register with name, email and password; the email is unique and the password is stored as a bcrypt hash.", "High", "Auth"],
    ["FR-02", "A user can log in and receives a short-lived access token and a refresh token.", "High", "Auth"],
    ["FR-03", "Refresh tokens are single use and revocable; logout revokes the token.", "High", "Auth"],
    ["FR-04", "A user can update their name and change their password (current password required).", "Medium", "Users"],
    ["FR-05", "A signed-in user can create a project and becomes its Project Lead.", "High", "Projects"],
    ["FR-06", "A user can list the projects they belong to and see their role in each.", "High", "Projects"],
    ["FR-07", "A Lead can edit project settings and delete the project together with its data and stored files.", "High", "Projects"],
    ["FR-08", "A Lead can add a registered user to the project, change a role and remove a member; a project always keeps one Lead.", "High", "Projects"],
    ["FR-09", "A Lead can see the widget key prefix, generate a key at creation and rotate it; the old key stops working.", "High", "Projects"],
    ["FR-10", "A Lead can set the list of allowed origins for the widget.", "High", "Projects"],
    ["FR-11", "A Lead can connect a GitHub repository and webhook secret and view the webhook delivery history.", "High", "GitHub"],
    ["FR-12", "A Lead and a Developer can see an overview: ticket counts, build counts, approval history and activity log.", "Medium", "Projects"],
    ["FR-13", "The widget shows a Report issue button on the staging site and signs the tester in with a project-scoped token.", "High", "Widget"],
    ["FR-14", "The widget captures a screenshot of the visible page.", "High", "Widget"],
    ["FR-15", "The widget collects console errors, uncaught exceptions, failed fetch and failed XHR calls in a bounded rolling buffer without secrets.", "High", "Widget"],
    ["FR-16", "The tester can draw arrows and boxes, blur sensitive areas, undo and redo; blurred areas are destroyed before upload.", "High", "Widget"],
    ["FR-17", "The tester is told what will be sent before sending, and submits a report with description and severity.", "High", "Widget"],
    ["FR-18", "The API validates the project key, the origin and the widget token and rate-limits widget requests.", "High", "Reports"],
    ["FR-19", "The API creates a ticket with sanitised evidence, annotations and the stored screenshot in one transaction.", "High", "Reports"],
    ["FR-20", "A member can create a ticket manually; a Developer or Lead can edit title, description, severity and assignee.", "High", "Tickets"],
    ["FR-21", "Tickets can be searched, filtered by status, severity, assignee and build, sorted and paginated.", "High", "Tickets"],
    ["FR-22", "The ticket page shows the annotated screenshot, environment data, console errors and a failed-request viewer (engineering roles only).", "High", "Tickets"],
    ["FR-23", "Status changes follow Open, In progress, Resolved, Verified with reopening; every transition is permitted only to specific roles.", "High", "Tickets"],
    ["FR-24", "Members can comment, edit their own comments and delete them (authors and Leads).", "Medium", "Tickets"],
    ["FR-25", "A Developer can link a branch or pull request number to a ticket and mark duplicates.", "High", "Tickets"],
    ["FR-26", "Every ticket change is recorded in an activity history.", "Medium", "Activity"],
    ["FR-27", "The webhook endpoint verifies the HMAC-SHA256 signature and rejects invalid signatures with 401.", "High", "GitHub"],
    ["FR-28", "A merged pull request moves linked Open and In progress tickets of that project to Resolved.", "High", "GitHub"],
    ["FR-29", "A repeated delivery (same delivery id) is ignored and nothing is applied twice.", "High", "GitHub"],
    ["FR-30", "A Developer can register a build (branch, commit SHA, preview URL) and mark it ready for review.", "High", "Builds"],
    ["FR-31", "A client sees only builds that were shared with them and the open and blocking tickets of each build.", "High", "Builds"],
    ["FR-32", "A client can approve a build or request changes with a note; the decision stores the user, the time and the commit SHA.", "High", "Builds"],
    ["FR-33", "A build cannot be approved while High or Blocker tickets are not verified.", "High", "Builds"],
    ["FR-34", "Approval history is available per build and per project.", "Medium", "Builds"],
    ["FR-35", "Uploads are validated by size, declared type and file signature and re-encoded; files are private and served through expiring URLs.", "High", "Files"],
    ["FR-36", "Screenshots of long-verified tickets can be removed by a retention job.", "Low", "Files"],
    ["FR-37", "All list endpoints for large collections return pagination metadata (page, limit, total).", "Medium", "Common"],
    ["FR-38", "All errors use one JSON shape; stack traces and database messages are never returned.", "High", "Common"],
  ];
  c.push(table(["ID", "Requirement", "Priority", "Module"], fr, [800, 6638, 1000, 1200]));
  c.push(H2("2.2 Non-functional requirements"));
  c.push(table(["ID", "Category", "Requirement", "How it is checked"], [
    ["NFR-01", "Security", "Passwords stored as bcrypt hashes (cost 12). Access tokens expire after 15 minutes. Secrets come from the environment and are validated at start-up.", "auth tests inspect the stored hash format; the API refuses to start without secrets"],
    ["NFR-02", "Security", "Every route needs a valid token except register, login, refresh, logout, health, the signed webhook and the widget routes (which need the project key and an allowed origin). Role checks run on every project route.", "Figures 6.5, 6.6; 162 API tests including cross-project access"],
    ["NFR-03", "Privacy", "Authorization headers, cookies, tokens and password values are removed from stored evidence; a blurred region cannot be recovered from the stored image.", "sanitisation unit tests; the stored blur region has 91 distinct colours over 49,288 pixels (Section 7.3)"],
    ["NFR-04", "Performance", "Typical list, detail and status requests answer in under 250 ms on a development machine with the demo data.", "Postman times of 5 to 109 ms in Figures 6.6 to 6.12; the X-Response-Time header"],
    ["NFR-05", "Data integrity", "Multi-table operations run in a transaction; foreign keys, unique keys and enums are enforced by the database.", "rollback tests (Figure 6.13); ER diagram"],
    ["NFR-06", "Reliability", "A webhook delivery is applied at most once, even if GitHub redelivers it.", "unique delivery id; replay test"],
    ["NFR-07", "Usability", "Validation errors name the failing field; the interface works from 375 px wide to desktop; forms have labels and focus styles.", "Figure 6.3; Figure 6.24"],
    ["NFR-08", "Maintainability", "One NestJS module per feature, DTOs for every input, ESLint with no errors, automated tests.", "ESLint 0 errors; 162 API tests and 21 widget tests (Figure 6.16)"],
    ["NFR-09", "Portability", "The schema is built only from migrations and all settings come from environment variables.", "migrations applied to an empty database (Figure 6.14)"],
    ["NFR-10", "Auditability", "Approvals, role changes, key rotations and ticket changes are recorded with user and time.", "activity log table; overview page"],
    ["NFR-11", "Scalability", "The API keeps no session state, so several instances can run behind a load balancer.", "design review"],
    ["NFR-12", "Availability limits", "On free hosting the API sleeps after 15 idle minutes and wakes in up to about one minute; a daily ping keeps the database project active.", "documented in the deployment guide"],
  ], [800, 1300, 4338, 3200]));
  c.push(H2("2.3 Constraints and assumptions"));
  c.push(bullet("The project uses PostgreSQL with Prisma, as specified in the proposal. The project guide assumes TypeORM; this difference is explained in Chapter 8."));
  c.push(bullet("html2canvas redraws the page from the DOM, so some CSS (filters, blend modes), cross-origin images without CORS headers, iframes and video can look different or blank. The proposal accepts this limitation."));
  c.push(bullet("Free hosting is used (Vercel, Render, Supabase), so cold starts are expected."));
  c.push(bullet("The reporter is a signed-in user (the data model requires a reporter), so the widget asks the tester to sign in with an account that belongs to the project."));
  c.push(bullet("E-mail notifications are optional in the proposal and are not built."));
  c.push(bullet("The demo accounts are fictional and created by the seed script."));
  return c;
}

async function useCaseLand() {
  const c = [];
  c.push(H2("3.2 Use case diagram"));
  c.push(...await figure("usecase.png", "Figure 3.1: Use case diagram of InspectFlow", 1000, 520));
  return c;
}

async function bodyPart3() {
  const c = [];
  c.push(H2("3.4 Use case descriptions"));
  const uc = (title, rows) => [H3(title), kv(rows), spacer(160)];
  c.push(...uc("UC-02 Report an issue from the staging site", [
    ["Actor", "Tester / Client Reviewer (primary)"],
    ["Preconditions", "The staging site includes the widget script. The tester has an account that is a member of the project. The site's address is in the project's allowed origins."],
    ["Main flow", "1. The tester clicks Report issue and signs in; the widget receives a token valid for this project only.\n2. The widget hides itself, captures the page with html2canvas and shows the annotation screen with the list of what will be sent.\n3. The tester draws arrows and boxes, blurs private data and writes a description and severity.\n4. On send, the widget flattens the image: every blur region is replaced by large flat blocks before upload.\n5. The API checks the project key, the origin, the token, the payload and the image (size, type, magic bytes) and re-encodes it as PNG.\n6. In one transaction the API creates the ticket, the sanitised events, the annotations, the screenshot record and an activity entry.\n7. The API returns 201 with the ticket number."],
    ["Alternative flows", "A1. Unknown key: 401. A2. Origin not allowed: 403. A3. Not a project member: 401. A4. File is not a real image or exceeds 5 MB: 415 or 413. A5. Invalid payload: 400 naming the field. A6. Database error: 500 with a generic message and the stored file is deleted."],
    ["Postcondition", "A ticket with evidence exists in OPEN status, or nothing was stored."],
  ]));
  c.push(...uc("UC-09 Approve a build", [
    ["Actor", "Tester / Client Reviewer (primary)"],
    ["Preconditions", "The client is a member of the project. The build was marked ready for review (status IN_REVIEW)."],
    ["Main flow", "1. The client opens the review page: build summary, blocking tickets, all open tickets and decision history.\n2. The client chooses Approve build and confirms.\n3. The API starts a transaction and locks the build row (SELECT ... FOR UPDATE).\n4. It checks that the build is still IN_REVIEW and that no High or Blocker ticket is unverified.\n5. It inserts the BuildApproval with the user, decision, note, time and the build's commit SHA, and sets the build to APPROVED.\n6. It writes an activity entry, commits and returns 201."],
    ["Alternative flows", "A1. Blocking tickets exist: 409 and nothing changes (Figure 6.10). A2. The build was already decided: 409. A3. A Developer or Lead tries to decide: 403. A4. A client of another project: 404. A5. Request changes: a note is required (400 otherwise) and the build becomes REJECTED. A6. Two clients decide at the same time: the lock serialises them and exactly one succeeds."],
    ["Postcondition", "The build is APPROVED and the approval is stored against the exact commit, or nothing changed."],
  ]));
  c.push(...uc("UC-14 Resolve a ticket when its pull request is merged", [
    ["Actor", "GitHub (primary), Developer (set-up)"],
    ["Preconditions", "The Lead connected the repository and webhook secret. A Developer linked a branch or pull request number to the ticket."],
    ["Main flow", "1. GitHub sends a pull_request event with X-Hub-Signature-256 and X-GitHub-Delivery.\n2. The API finds the project by repository name and computes the HMAC-SHA256 of the raw body with the project's secret.\n3. It compares the signatures in constant time.\n4. In one transaction it inserts the WebhookDelivery (the delivery id is unique) and applies the event.\n5. For a merged pull request, every Open or In progress ticket of that project linked by number or branch becomes Resolved and an automatic activity entry is written.\n6. It returns 200 with the outcome."],
    ["Alternative flows", "A1. Invalid or missing signature: 401 (Figure 6.12); the attempt is recorded. A2. Unknown repository: the same 401. A3. Replayed delivery id: the insert fails, the transaction rolls back and the response says duplicate. A4. Pull request closed without merge: ignored. A5. Tickets of other projects with the same branch name are not touched."],
    ["Postcondition", "Linked tickets are Resolved exactly once, and the delivery is in the history."],
  ]));
  return c;
}

async function erLand() {
  const c = [];
  c.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun({ text: "3.3 ER diagram", font: FONT })] }));
  c.push(...await figure("er.png", "Figure 3.2: Entity relationship diagram (crow's foot notation). Full-size image: docs/report/images/er.png", 1000, 520));
  return c;
}

async function bodyPart5() {
  const c = [];
  c.push(H2("3.5 Relationships"));
  c.push(table(["Relationship", "Cardinality", "Implemented by", "On delete"], [
    ["User has Memberships", "1 : N", "Membership.userId", "CASCADE"],
    ["Project has Memberships (the role lives here)", "1 : N", "Membership.projectId; unique (userId, projectId)", "CASCADE"],
    ["Project owns Builds", "1 : N", "Build.projectId", "CASCADE"],
    ["Project owns Tickets", "1 : N", "Ticket.projectId; unique (projectId, number)", "CASCADE"],
    ["Build groups Tickets", "1 : 0..N", "Ticket.buildId (nullable)", "SET NULL"],
    ["Build is decided by Approvals", "1 : N", "BuildApproval.buildId", "CASCADE"],
    ["User makes Approvals", "1 : N", "BuildApproval.userId", "RESTRICT"],
    ["User reports Tickets", "1 : N", "Ticket.reporterId", "RESTRICT"],
    ["User is assigned Tickets", "1 : 0..N", "Ticket.assigneeId (nullable)", "SET NULL"],
    ["Ticket may duplicate another Ticket", "1 : 0..N", "Ticket.duplicateOfId (self reference)", "SET NULL"],
    ["Ticket has Annotations, Artifacts, CapturedEvents, Comments", "1 : N each", "ticketId in each table", "CASCADE"],
    ["User writes Comments", "1 : N", "Comment.authorId", "RESTRICT"],
    ["Project receives WebhookDeliveries", "1 : N", "WebhookDelivery.projectId; unique deliveryId", "CASCADE"],
    ["Project and Ticket have ActivityLog entries", "1 : N", "ActivityLog.projectId, ticketId (nullable), actorId (nullable)", "CASCADE, CASCADE, SET NULL"],
    ["User owns RefreshTokens", "1 : N", "RefreshToken.userId; unique tokenHash", "CASCADE"],
  ], [3300, 1300, 3538, 1500]));
  c.push(P("User and Project are linked many-to-many through Membership, which also carries the role. Deleting a project removes everything it owns. A user who has reported tickets, written comments or made approvals cannot be deleted, so the audit trail stays intact. RefreshToken and ActivityLog are supporting tables that are not in the proposal's entity list."));
  c.push(H2("3.6 Keys and constraints"));
  c.push(table(["Table", "Notable constraints"], [
    ["User", "email unique and not null; passwordHash never returned by any endpoint"],
    ["Project", "apiKeyPrefix unique; only a SHA-256 hash of the widget key is stored; githubRepo unique and lower-case; webhookSecret never returned; nextTicketNo counter"],
    ["Membership", "unique (userId, projectId); role is an enum LEAD, DEVELOPER, TESTER_CLIENT; index on projectId"],
    ["Build", "status enum DRAFT, IN_REVIEW, APPROVED, REJECTED; index on (projectId, status)"],
    ["BuildApproval", "decision enum APPROVED, CHANGES_REQUESTED; commitSha copied from the build at decision time; index on buildId"],
    ["Ticket", "unique (projectId, number); severity enum LOW, MEDIUM, HIGH, BLOCKER; status enum OPEN, IN_PROGRESS, RESOLVED, VERIFIED; indexes on (projectId, status), (projectId, severity), buildId, assigneeId, (projectId, branch), (projectId, prNumber)"],
    ["Annotation / Artifact / CapturedEvent / Comment", "foreign key to Ticket with cascade; Artifact.storageKey unique and random; CapturedEvent type enum CONSOLE, NETWORK, ERROR; index on (ticketId, type)"],
    ["WebhookDelivery", "deliveryId unique, which is what makes a replayed delivery fail on insert"],
    ["RefreshToken", "tokenHash unique; revokedAt and expiresAt for revocation and expiry"],
    ["ActivityLog", "indexes on (projectId, createdAt) and (ticketId, createdAt); metadata stored as jsonb"],
  ], [2700, 6938]));
  c.push(H2("3.7 Ticket and build lifecycle"));
  c.push(...await figure("states.png", "Figure 3.3: State diagrams of the ticket and the build, with the roles that may perform each transition", 640, 340));
  c.push(P("The permission rule for every transition is one table in the code (`ticket-workflow.ts`), so it is unit tested directly. The GitHub webhook is the only actor that can resolve a ticket without a person."));

  // ------------------------------------------------ 4. Normalization
  c.push(H1("4. Database normalization"));
  c.push(P("Normalization started from the sheet that a team uses before InspectFlow exists: one row per reported problem, with project, build, reporter and technical details copied into every row. Two sample rows show the problems."));
  c.push(H2("4.1 Unnormalized form (UNF)"));
  c.push(table(["Rep.", "Project", "Staging URL", "Reporter", "Email", "Role", "Branch", "Commit", "Title", "Sev.", "Console / failed requests", "Status"], [
    ["R-1", "Acme Shop", "stg.acme.test", "Tara Tester", "tara@mail.test", "Tester", "release/s2", "9f8e7d6", "Pay button dead", "High", "TypeError at app.js:8; POST /api/orders 500", "Open"],
    ["R-2", "Acme Shop", "stg.acme.test", "Tara Tester", "tara@mail.test", "Tester", "release/s2", "9f8e7d6", "Cards overlap", "Medium", "(none)", "Open"],
  ], [520, 760, 880, 820, 900, 640, 800, 700, 900, 520, 1700, 498], { size: 15 }));
  c.push(P("Problems: the console and request cell of R-1 holds two values; the project, reporter and build details repeat on every report; a reporter's role is stored in every row although it depends on the project; and the commit would have to be edited in many rows if a build were corrected."));
  c.push(H2("4.2 First normal form (1NF)"));
  c.push(P("1NF requires atomic values and no repeating groups. Each console error or failed request gets its own row, so the evidence is split from the report. The report is identified by its number, the evidence row by (report, event number)."));
  c.push(code("report(Rep PK, Project, StagingUrl, Reporter, Email, Role, Branch, Commit, Title, Severity, Status)\nevent(Rep FK, EventNo, Type, Method, Url, StatusCode, Message)        PK (Rep, EventNo)"));
  c.push(H2("4.3 Second normal form (2NF)"));
  c.push(P("2NF removes partial dependencies, where an attribute depends on only part of a composite key. In `event` every attribute depends on both Rep and EventNo, so it stays. In `report` the key is a single column, so partial dependencies cannot occur there; but the reporter's Role depends on the pair (Reporter, Project), not on the report. That pair is a many-to-many link between users and projects, so it becomes its own relation."));
  c.push(code("membership(User FK, Project FK, Role)                          PK (User, Project)"));
  c.push(H2("4.4 Third normal form (3NF)"));
  c.push(P("3NF removes transitive dependencies, where a non-key attribute depends on another non-key attribute. Three appear in `report`:"));
  c.push(bullet("Rep -> Project -> StagingUrl: project details belong in a `project` relation."));
  c.push(bullet("Rep -> Reporter -> Email: user details belong in a `user` relation."));
  c.push(bullet("Rep -> Build -> Branch, Commit: the build belongs in its own relation, which later also carries its status and its approvals."));
  c.push(P("Further, a report has a variable number of screenshots, annotations and comments, so each becomes a child relation; a ticket number is unique only within a project; and a decision on a build is a separate fact with its own user, time and note, so it is not part of the build row."));
  c.push(P("Resulting relations (they match the Prisma schema and Figure 3.2):", { keepNext: true }));
  c.push(code("user(id PK, name, email UNIQUE, password_hash, created_at)\nproject(id PK, name, staging_url, api_key_prefix UNIQUE, api_key_hash, allowed_origins, github_repo UNIQUE, webhook_secret, next_ticket_no)\nmembership(id PK, user_id FK, project_id FK, role)                  UNIQUE (user_id, project_id)\nbuild(id PK, project_id FK, name, branch, commit_sha, preview_url, status)\nbuild_approval(id PK, build_id FK, user_id FK, decision, note, commit_sha, decided_at)\nticket(id PK, project_id FK, number, build_id FK null, reporter_id FK, assignee_id FK null,\n       duplicate_of_id FK null, title, description, severity, status, page_url, viewport,\n       user_agent, branch, pr_number, resolved_at)                  UNIQUE (project_id, number)\nannotation(id PK, ticket_id FK, type, shape_json)\nartifact(id PK, ticket_id FK, kind, storage_key UNIQUE, mime_type, size_bytes)\ncaptured_event(id PK, ticket_id FK, type, method, url, status_code, duration_ms, message, stack, timestamp)\ncomment(id PK, ticket_id FK, author_id FK, body, created_at)\nwebhook_delivery(id PK, project_id FK, event, delivery_id UNIQUE, signature_valid, outcome)\nrefresh_token(id PK, user_id FK, token_hash UNIQUE, expires_at, revoked_at)\nactivity_log(id PK, project_id FK, ticket_id FK null, actor_id FK null, action, metadata)"));
  c.push(P("In every relation each determinant is a candidate key (the id, the unique email, the unique key hash prefix, the composite key of membership), so the design is also in Boyce-Codd normal form. One deliberate exception to avoid repeating derived data: `build_approval.commit_sha` stores a copy of the build's commit at the time of the decision, because the sign-off must stay true even if the build row is edited later."));
  return c;
}

// ---------------- API tables ----------------
const API = [
  ["Auth", [
    ["POST", "/auth/register", "Create an account; returns tokens", "Public"],
    ["POST", "/auth/login", "Sign in; returns access and refresh tokens", "Public"],
    ["POST", "/auth/refresh", "Exchange a single-use refresh token", "Public"],
    ["POST", "/auth/logout", "Revoke a refresh token", "Public"],
    ["GET", "/auth/me", "Current user", "Any signed-in user"],
    ["GET", "/users/me", "Own profile", "Any signed-in user"],
    ["PATCH", "/users/me", "Change name or password", "Any signed-in user"],
  ]],
  ["Projects, members and GitHub", [
    ["POST", "/projects", "Create a project; creator becomes Lead; key shown once", "Any signed-in user"],
    ["GET", "/projects", "Projects I belong to (opt-in pagination)", "Any signed-in user"],
    ["GET", "/projects/:projectId", "One project with my role", "Member"],
    ["PATCH", "/projects/:projectId", "Edit name, description, staging URL, allowed origins", "Lead"],
    ["DELETE", "/projects/:projectId", "Delete project, data and stored files", "Lead"],
    ["POST", "/projects/:projectId/rotate-key", "Generate a new widget key", "Lead"],
    ["GET", "/projects/:projectId/members", "List members (opt-in pagination)", "Member"],
    ["GET", "/projects/:projectId/members/:membershipId", "One member", "Member"],
    ["POST", "/projects/:projectId/members", "Add a registered user with a role", "Lead"],
    ["PATCH", "/projects/:projectId/members/:membershipId", "Change a role", "Lead"],
    ["DELETE", "/projects/:projectId/members/:membershipId", "Remove a member", "Lead"],
    ["PATCH", "/projects/:projectId/github", "Connect owner/repo and webhook secret", "Lead"],
    ["GET", "/projects/:projectId/webhook-deliveries", "Delivery history (paged)", "Lead, Developer"],
    ["GET", "/projects/:projectId/overview", "Counts, approvals, activity", "Lead, Developer"],
  ]],
  ["Tickets and comments", [
    ["GET", "/projects/:projectId/tickets", "Search, filter, sort, paginate", "Member (Tester: own reports)"],
    ["POST", "/projects/:projectId/tickets", "Create a ticket manually", "Member"],
    ["GET", "/tickets/:ticketId", "Detail with signed screenshot URL, evidence, comments, activity", "Member (Tester: own ticket, no technical events)"],
    ["PATCH", "/tickets/:ticketId", "Edit title, description, severity, assignee, build", "Lead, Developer"],
    ["DELETE", "/tickets/:ticketId", "Delete ticket and its files", "Lead"],
    ["POST", "/tickets/:ticketId/status", "Change status (role-checked transition)", "By transition"],
    ["POST", "/tickets/:ticketId/link", "Link a branch and/or pull request", "Lead, Developer"],
    ["POST", "/tickets/:ticketId/duplicate", "Mark as duplicate", "Lead, Developer"],
    ["GET", "/tickets/:ticketId/comments", "Paged comments", "Member who sees the ticket"],
    ["POST", "/tickets/:ticketId/comments", "Add a comment", "Member who sees the ticket"],
    ["PATCH", "/comments/:commentId", "Edit own comment", "Author"],
    ["DELETE", "/comments/:commentId", "Delete a comment", "Author or Lead"],
  ]],
  ["Builds and approval", [
    ["GET", "/projects/:projectId/builds", "Builds with blocking counts (clients: non-draft only)", "Member"],
    ["POST", "/projects/:projectId/builds", "Register a build (starts as Draft)", "Lead, Developer"],
    ["GET", "/projects/:projectId/approvals", "Approval history of the project", "Lead, Developer"],
    ["GET", "/builds/:buildId", "One build with approvals", "Member (clients: not drafts)"],
    ["PATCH", "/builds/:buildId", "Edit a draft build", "Lead, Developer"],
    ["DELETE", "/builds/:buildId", "Delete a draft or rejected build", "Lead"],
    ["POST", "/builds/:buildId/ready", "Share with clients: Draft to In review", "Lead, Developer"],
    ["GET", "/builds/:buildId/review", "Review data: blocking and open tickets, canApprove", "Member (clients: not drafts)"],
    ["POST", "/builds/:buildId/decision", "APPROVED or CHANGES_REQUESTED with note (transaction + lock)", "Tester / Client"],
  ]],
  ["Widget, webhook and health", [
    ["GET", "/widget/config", "Project name and list of what the widget captures", "Project key + allowed origin"],
    ["POST", "/widget/login", "Tester sign-in; project-scoped token", "Project key + allowed origin"],
    ["POST", "/reports", "Create a ticket from a report (multipart: payload + screenshot)", "Key + origin + widget token"],
    ["POST", "/webhooks/github", "GitHub pull_request events (HMAC verified)", "HMAC signature"],
    ["GET", "/health", "Status and database check", "Public"],
    ["GET", "/", "Name and links", "Public"],
  ]],
];

async function bodyPart6() {
  const c = [];
  c.push(H1("5. List of APIs"));
  c.push(P("Base URL (local): `http://localhost:5001`. Base URL (deployed): `https://inspectflow-api.onrender.com`. All routes return JSON, except the multipart upload `POST /reports`. The table lists 48 operations on 33 paths. Access levels: **Public** needs no token; **Member** means any role in that project; **Lead**, **Developer** and **Tester / Client** are project roles. Non-members always get 404, never 403, so other projects' existence is not revealed."));
  c.push(H2("5.1 Response and error format"));
  c.push(P("Lists that support pagination return `items`, `total`, `page` and `limit`. Pagination is always on for tickets, comments and webhook deliveries, and opt-in (by passing page or limit) for projects, members and builds. Every error has one shape, produced by a global exception filter:"));
  c.push(code('{ "success": false, "statusCode": 409, "error": "Conflict",\n  "message": "Cannot approve: 1 blocking ticket(s) are not verified yet",\n  "path": "/builds/ba12.../decision", "timestamp": "2026-11-15T02:58:47.895Z" }'));
  c.push(spacer(80));
  c.push(table(["Status", "Used when"], [
    ["200 / 201", "Success / resource created (status changes and other POST actions also return 201)"],
    ["400", "Validation failed (the message names the field), unknown field, malformed JSON, invalid query value"],
    ["401", "Token missing, invalid or expired; wrong login; invalid webhook signature; bad widget key"],
    ["403", "Valid token but the project role does not allow the action; widget origin not allowed"],
    ["404", "Not found, or not visible to the caller (another project, someone else's ticket, a draft build for a client)"],
    ["409", "Duplicate email, repository or member; blocking tickets; build already decided"],
    ["413 / 415", "Screenshot too large / not a real PNG, JPEG or WebP image"],
    ["429", "Rate limit exceeded"],
    ["500", "Unexpected error; the message is generic and details go to the server log"],
  ], [1400, 8238]));
  c.push(H2("5.2 Endpoints"));
  for (const [group, rows] of API) {
    c.push(H3(group));
    c.push(table(["Method", "Endpoint", "Description", "Access"], rows, [900, 3400, 3338, 2000], { size: 17 }));
    c.push(spacer(100));
  }
  c.push(H2("5.3 Sample request and response bodies"));
  c.push(H3("POST /auth/register"));
  c.push(code('Request  { "name": "Report Student", "email": "student02@example.test", "password": "Password123" }\nResponse 201\n{ "accessToken": "eyJhbGciOi...", "refreshToken": "o9qfZ0k4...",\n  "user": { "id": "09db78e6-...", "name": "Report Student", "email": "student02@example.test" } }'));
  c.push(H3("POST /tickets/:ticketId/status  (Developer)"));
  c.push(code('Request  { "status": "IN_PROGRESS", "note": "Reproduced locally, working on a fix." }\nResponse 201  { "id": "04b06744-...", "number": 1, "status": "IN_PROGRESS", "severity": "HIGH", ... }\nTester  -> 403 "A TESTER_CLIENT cannot move a ticket from OPEN to IN_PROGRESS"'));
  c.push(H3("POST /reports  (widget, multipart)"));
  c.push(code('Headers  X-InspectFlow-Key: if_pk_...   Origin: https://staging.example.com   Authorization: Bearer <widget token>\nFields   payload = { "description": "Pay now does nothing", "severity": "HIGH", "pageUrl": "...",\n                      "viewport": "1280x720", "userAgent": "...", "events": [ ... ], "annotations": [ ... ] }\n         screenshot = PNG file (max 5 MB)\nResponse 201  { "id": "c0780154-...", "number": 4, "status": "OPEN" }'));
  c.push(H3("POST /builds/:buildId/decision  (Client)"));
  c.push(code('Request  { "decision": "APPROVED", "note": "All blocking issues verified. Approved." }\nResponse 201 { "approval": { "decision": "APPROVED", "commitSha": "9f8e7d6c5b4a...", "decidedAt": "..." },\n               "build": { "status": "APPROVED" } }\nBlocked  409 "Cannot approve: 1 blocking ticket(s) are not verified yet"'));
  c.push(H3("POST /webhooks/github"));
  c.push(code('Headers  X-GitHub-Event: pull_request   X-GitHub-Delivery: <uuid>   X-Hub-Signature-256: sha256=<hmac of raw body>\nResponse 200  { "received": true, "outcome": "resolved 1 ticket(s) via PR #21" }\nReplay   200  { "received": true, "duplicate": true }        Bad signature  401'));
  c.push(H2("5.4 Requirement coverage"));
  c.push(P("Where each requirement of the CSC4161 project guide is implemented:"));
  c.push(table(["Requirement", "Implementation"], [
    ["**Minimum**", ""],
    ["Multiple entities with CRUD", "Projects, tickets, builds, comments and members each have create, list, get-by-id, update and delete endpoints (Section 5.2). 201 on create, 404 when missing, pagination metadata on lists."],
    ["Database integration and a transaction", "PostgreSQL through Prisma with foreign keys and migrations. Ticket creation, build decision and webhook processing run in `prisma.$transaction`; Figure 6.13 shows a forced failure that leaves the data unchanged."],
    ["JWT authentication and authorization", "`AuthModule`, `JwtStrategy`, global `JwtGuard`, `ProjectRolesGuard` with three project roles; 401 without token (Figure 6.5), 403 for the wrong role (Figure 6.6)."],
    ["Input validation with DTOs", "class-validator DTOs; separate create and update DTOs (project, build, ticket); global ValidationPipe with whitelist and forbidNonWhitelisted; 400 naming the field (Figure 6.3)."],
    ["HTTP exception handling", "Built-in HTTP exceptions and one `AllExceptionsFilter`; Prisma unique-key errors become 409 (Figure 6.4); no stack traces are returned."],
    ["**Bonus**", ""],
    ["Middleware", "`RequestLoggerMiddleware`: method, path, status, duration and a request id; query strings are dropped so tokens never reach logs."],
    ["Custom decorators", "`@Public()`, `@CurrentUser()`, `@CurrentMembership()`, `@ProjectRoles(...)`."],
    ["Mailer", "Not built (e-mail notifications are optional in the proposal)."],
    ["Swagger UI", "`/api/docs` with bearer authentication (Figure 6.1); the Nest Swagger plugin infers the DTO schemas."],
    ["Interceptors", "`TimingInterceptor` adds an X-Response-Time header."],
    ["Audit log", "`ActivityLog` records ticket changes, approvals, role changes, key rotation and GitHub connection."],
    ["Env", "Zod-validated environment, `.env.example` committed, no secrets in Git."],
    ["Migrations", "Prisma migrations; a fresh database is built only from them (Figure 6.14)."],
    ["Response manipulation", "Password hashes, key hashes and webhook secrets are never returned; pagination metadata; signed screenshot URLs."],
    ["Database transaction (advanced)", "`SELECT ... FOR UPDATE` on the build row; concurrent decisions produce exactly one approval (tested with three parallel requests)."],
  ], [2700, 6938]));
  return c;
}

async function bodyPart7() {
  const c = [];
  c.push(H1("6. Screenshots of functionality"));
  c.push(P("Each figure below shows one function. Figures 6.2 to 6.12 are Postman requests sent to the API with the base URL `http://localhost:5001`, with the fictional demo accounts created by the seed script. They include the failure cases required by the guide: 401, 403, 400 and 409, and the transaction rollback. Figures 6.1, 6.19 and 6.22 were taken from the deployed system on Vercel and Render; Figures 6.17, 6.18 and 6.20 to 6.24 from a local run of the dashboard (the data are the same fictional demo data)."));
  const S = (f) => path.join(IMG, "shots", f);
  const T = (f) => path.join(IMG, "term", f);
  const list = [
    [S("f01-swagger-overview.jpg"), "Figure 6.1: Swagger UI of the deployed API (https://inspectflow-api.onrender.com/api/docs), endpoint groups and the Authorize button", 520],
    [S("p01-register-201-c.png"), "Figure 6.2: POST /auth/register returns 201 Created with tokens and no password hash", 600],
    [S("p03-register-400-c.png"), "Figure 6.3: DTO validation error, 400 Bad Request, the messages name the failing fields", 600],
    [S("p02-register-409-c.png"), "Figure 6.4: Duplicate email, 409 Conflict", 600],
    [S("p05-projects-401-c.png"), "Figure 6.5: GET /projects without a token, 401 Unauthorized", 600],
    [S("p07-tester-patch-403-c.png"), "Figure 6.6: A Tester tries to edit project settings, 403 Forbidden (role not allowed)", 600],
    [S("p04-login-200-c.png"), "Figure 6.7: POST /auth/login returns the access token (200 OK)", 600],
    [S("p06-tickets-search-200-c.png"), "Figure 6.8: Ticket list with search, sort and pagination parameters, 200 OK with the first ticket and the evidence fields", 600, 640],
    [S("p08-status-201-c.png"), "Figure 6.9: A Developer starts work on the ticket, status becomes IN_PROGRESS (201 Created)", 600],
    [S("p09-approve-409-c.png"), "Figure 6.10: The client cannot approve a build while a blocking ticket is not verified, 409 Conflict", 600],
    [S("p11-widget-403-c.png"), "Figure 6.11: Widget request from a foreign origin, 403 Forbidden (origin check on the server)", 600],
    [S("p10-webhook-401-c.png"), "Figure 6.12: GitHub webhook with an invalid signature, 401 Unauthorized", 600],
    [T("rollback.png"), "Figure 6.13: Transaction rollback tests: a forced failure in the last step leaves the data unchanged (real PostgreSQL)", 600],
    [T("migrations.png"), "Figure 6.14: Migrations build the schema on an empty database", 600],
    [T("db.png"), "Figure 6.15: The 13 tables created by the migrations, and the seeded tickets", 600],
    [T("tests.png"), "Figure 6.16: Automated test run: 12 suites, 162 API tests passed", 600],
    [S("d01-tickets-list.jpg"), "Figure 6.17: Developer ticket dashboard with filters, sorting and the new report at the top (local run)", 520],
    [S("w01-annotated-upload.png"), "Figure 6.18: The image stored for a report: arrow, box and blurred promo-code field. The blurred pixels were destroyed before upload", 520],
    [S("f03-staging-live.jpg"), "Figure 6.19: Demo staging site on Vercel with the embedded widget button (Report issue, bottom right)", 520],
    [S("d02-ticket-detail.jpg"), "Figure 6.20: Ticket detail with the annotated screenshot loaded from a private signed URL (local run)", 520],
    [S("d03-evidence.jpg"), "Figure 6.21: Technical evidence viewer: the uncaught TypeError with stack and the console error, and the environment panel", 520],
    [S("f02-login-demo.jpg"), "Figure 6.22: Login page of the deployed dashboard with the demo accounts box (live)", 480],
    [S("d04-build-approved.jpg"), "Figure 6.23: Client build review after approval: the decision is stored with the commit SHA, the approver and the note (local run)", 520],
    [S("d05-build-mobile.jpg"), "Figure 6.24: The same page at phone width (375 px, local run)", 260, 560],
  ];
  for (const [file, cap, w, h] of list) c.push(...await figure(file, cap, w, h ?? 620));
  return c;
}

async function bodyPart8() {
  const c = [];
  c.push(H1("7. Implementation highlights"));
  c.push(H2("7.1 Architecture and data flow"));
  c.push(...await figure("architecture.png", "Figure 7.1: System architecture. The browser, the widget and GitHub talk to one REST API", 600, 300));
  c.push(...await figure("sequence.png", "Figure 7.2: Sequence of the main journey, from the tester's click to the client's approval", 600, 360));
  c.push(H2("7.2 DTO validation and the global pipe"));
  c.push(P("Every input has a DTO class whose rules are checked before the controller runs. The global pipe strips unknown properties and rejects unexpected ones with a 400 that names the field."));
  c.push(code('export class RegisterDto {\n  @IsString() @MinLength(2) @MaxLength(80)\n  name!: string;\n\n  @Transform(lower) @IsEmail() @MaxLength(200)\n  email!: string;\n\n  // bcrypt only uses the first 72 bytes, so longer passwords are rejected.\n  @IsString() @MinLength(8, { message: "password must be at least 8 characters" }) @MaxLength(72)\n  password!: string;\n}\n\napp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));'));
  c.push(H2("7.3 Irreversible blur before upload"));
  c.push(P("The widget does not upload the Konva drawing. When the tester presses send, it redraws the original screenshot and replaces every blur region by large flat blocks. Each block takes the average colour of the pixels it covered. Averaging is many-to-one, so the original pixels cannot be recovered, and the function overwrites the pixel data in place. Only this flattened image is uploaded."));
  c.push(code("export function pixelate(data, width, height, rect, block = blockSizeFor(rect)) {\n  for (let by = y0; by < y1; by += block) {\n    for (let bx = x0; bx < x1; bx += block) {\n      // average the colour of every pixel in this block ...\n      // ... then write that single colour back into all of them\n    }\n  }\n}"));
  c.push(P("Verified in two ways. A unit test builds a random image, blurs a region and checks that fewer than 2 percent of the pixels still match the original, and that two different images with the same block averages give identical output. In the real run (Figure 6.18) the blurred promo-code area of the stored PNG contained 91 distinct colours across 49,288 pixels."));
  c.push(H2("7.4 Evidence sanitisation"));
  c.push(P("The widget removes secrets before sending, and the server repeats the cleaning, so the database never holds them. Bearer tokens, JWTs and values of keys such as password, token, api_key, cookie and session are replaced by [REDACTED]; sensitive query parameters are redacted in URLs and fragments are dropped; methods, status codes and durations are validated; unknown event types are dropped; at most 200 events are accepted. In the live test the request `/api/orders?token=...` was stored as `?token=[REDACTED]`. Stored text is plain data and the dashboard renders it as text, which prevents stored XSS."));
  c.push(H2("7.5 Approval with a row lock"));
  c.push(code("return this.prisma.$transaction(async (tx) => {\n  await tx.$queryRaw`SELECT id FROM \"Build\" WHERE id = ${buildId} FOR UPDATE`;\n  const locked = await tx.build.findUniqueOrThrow({ where: { id: buildId } });\n  if (locked.status !== BuildStatus.IN_REVIEW) throw new ConflictException(...);\n\n  if (dto.decision === ApprovalDecision.APPROVED) {\n    const blocking = await tx.ticket.count({ where: { buildId, ...blockingWhere } });\n    if (blocking > 0) throw new ConflictException(`Cannot approve: ${blocking} blocking ticket(s) ...`);\n  }\n  const approval = await tx.buildApproval.create({ data: { buildId, userId: user.id,\n      decision: dto.decision, note: dto.note?.trim() || null, commitSha: locked.commitSha } });\n  const updated = await tx.build.update({ where: { id: buildId }, data: { status: ... } });\n  await this.activity.log({ ... }, tx);           // joins the same transaction\n  return { approval, build: updated };\n});"));
  c.push(P("The lock makes concurrent decisions queue up; the second sees that the build is no longer in review and gets 409. A test sends three decisions at once and checks that exactly one approval row exists. A second test makes the last step (the activity log) fail and checks that the approval and the status change are rolled back (Figure 6.13)."));
  c.push(H2("7.6 Webhook signature and replay protection"));
  c.push(code("// GitHub signs the RAW body: \"sha256=\" + HMAC-SHA256(secret, body)\nexport function isValidSignature(secret, rawBody, header) {\n  if (!header) return false;\n  return safeEqual(computeSignature(secret, rawBody), header);   // constant-time compare\n}\n\nawait this.prisma.$transaction(async (tx) => {\n  // first statement: throws P2002 if this delivery id was already processed\n  const delivery = await tx.webhookDelivery.create({ data: { projectId, event, deliveryId, signatureValid: true } });\n  const outcome = await this.applyEvent(tx, projectId, event, payload);\n  ...\n});"));
  c.push(P("The signature function is tested against GitHub's published example (secret \"It's a Secret to Everybody\", body \"Hello, World!\"). A replayed delivery fails on the unique delivery id, the transaction rolls back and the response says `duplicate: true`."));
  c.push(H2("7.7 Per-project authorization with one guard"));
  c.push(code("// global guard: any route with a :projectId path parameter needs membership\nconst roles = this.reflector.getAllAndOverride<ProjectRole[]>(PROJECT_ROLES_KEY, [handler, class]);\nreq.membership = await this.access.requireMember(req.user.id, projectId, roles);\n\n// requireMember: not a member -> 404 (hides the project), wrong role -> 403\n@ProjectRoles(LEAD) @Patch(\":projectId\")\nupdate(...) { ... }"));
  c.push(P("Routes keyed by a ticket or build id have no project parameter, so their services load the record first and then call the same `requireMember` with the record's project. Nobody can reach a ticket by guessing its id."));
  c.push(H2("7.8 Deployment"));
  c.push(P("The system runs on free tiers: the dashboard and the demo staging site on Vercel, the API on Render, and PostgreSQL and private S3-compatible storage on Supabase. The API's start command applies pending migrations and then starts the server, and the demo data is loaded by a one-time switch that runs the seed inside Render, where the secrets already live. A smoke test of 21 read-only checks against the live system passed: pages served, health with database up, the four demo logins, role filtering, a screenshot downloaded from the private bucket through a signed URL, and the widget origin check."));
  c.push(H2("7.9 Testing summary"));
  c.push(table(["Area", "Result"], [
    ["API unit and integration tests (Jest, real PostgreSQL)", "162 passed in 12 suites: authentication, per-project permissions, cross-project access, ticket lifecycle, uploads, widget ingest, webhook signature and replay, approvals, transactions, retention, rate limits"],
    ["Widget tests (Jest, jsdom)", "21 passed: irreversible blur, rolling buffer, console, fetch and XHR capture, secret removal"],
    ["Scripted end-to-end workflow", "21 of 21 checks: connect GitHub, blocked approval, signed webhooks resolve tickets, replay ignored, bad signature 401, tester verifies, client approves against the commit"],
    ["Live production smoke test", "21 of 21 read-only checks against the deployed system"],
    ["Type-check, lint, production builds", "0 type errors, 0 lint errors, all builds succeed"],
    ["Manual run in a real browser", "Report sent from the staging site with annotation; ticket evidence verified in the database and in the dashboard"],
  ], [3600, 6038]));

  c.push(H1("8. Conclusion and references"));
  c.push(P("InspectFlow meets the five minimum requirements of the guide and implements nine of the ten bonus items (the mailer is not built). A tester can report a visual problem from a staging site with real technical evidence, a developer can triage it and link it to a pull request, GitHub's merge resolves the ticket, and the client's approval is stored against the exact commit. Access is controlled per project, uploads and evidence are sanitised, and every multi-table change is atomic. The normalized schema has thirteen tables and avoids repeated project, user and build data."));
  c.push(H3("Differences from the guide and the proposal"));
  c.push(bullet("**Prisma instead of TypeORM.** The proposal specifies Prisma, and the guide allows an equivalent tool when the instructor accepts another stack. [[Confirm with your instructor that Prisma is accepted.]]"));
  c.push(bullet("**A frontend and a widget were built**, although the guide says a frontend is not required. Every requirement is still reachable through Swagger or Postman."));
  c.push(bullet("**Konva** is used in the embeddable widget (where the screenshot is taken), not in the dashboard; the dashboard only shows the annotated image."));
  c.push(H3("Known limits"));
  c.push(bullet("A merge on a real GitHub repository was not exercised; the webhook was tested with correctly signed requests built by the test code, which proves the signature check, replay protection and auto-resolve logic."));
  c.push(bullet("No e-mail notifications and no session replay; no automated browser (end-to-end UI) tests; manual checks used Chromium only."));
  c.push(bullet("html2canvas limitations (CSS, cross-origin images, iframes, video) as accepted in the proposal; the free API sleeps after 15 idle minutes and the first request can take up to a minute."));
  c.push(bullet("Access tokens are kept in the browser's local storage, which a cross-site scripting bug could expose; React escapes all text and the server stores captured text as plain data."));
  c.push(H3("Next steps"));
  c.push(P("A real-repository merge test, e-mail and Slack notifications, an automatic retention scheduler, rrweb session replay, a browser-extension version of the widget and Playwright end-to-end tests."));
  c.push(H3("References"));
  const refs = [
    "NestJS documentation. https://docs.nestjs.com",
    "Prisma documentation. https://www.prisma.io/docs",
    "PostgreSQL documentation. https://www.postgresql.org/docs/",
    "M. Jones, J. Bradley, N. Sakimura. JSON Web Token (JWT). RFC 7519. https://datatracker.ietf.org/doc/html/rfc7519",
    "R. Fielding, M. Nottingham, J. Reschke. HTTP Semantics. RFC 9110. https://datatracker.ietf.org/doc/html/rfc9110",
    "GitHub Docs. Validating webhook deliveries (X-Hub-Signature-256). https://docs.github.com/webhooks",
    "class-validator. https://github.com/typestack/class-validator",
    "html2canvas. https://html2canvas.hertzen.com",
    "Konva. https://konvajs.org",
    "OWASP. Cross Site Scripting Prevention Cheat Sheet. https://cheatsheetseries.owasp.org",
    "Render, Supabase and Vercel documentation of free-tier limits (as published at the time of deployment, November 2026).",
    "CSC4161 Project Proposal Guide and Sample Report, Fall 2026.",
  ];
  refs.forEach((r) => c.push(bullet(r)));
  return c;
}

// =====================================================================
// ASSEMBLE
// =====================================================================
function footer(label) {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
    run(label + "   |   page ", { size: 16, color: "6B7791" }),
    new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "6B7791" }),
  ] })] });
}
const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "B9C2D6", space: 4 } }, children: [run("InspectFlow   |   CSC4161 Project Report", { size: 16, color: "6B7791" })] })] });

const portrait = { page: { size: { width: A4.w, height: A4.h }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } };
const landscape = { page: { size: { width: A4.w, height: A4.h, orientation: PageOrientation.LANDSCAPE }, margin: { top: 700, bottom: 700, left: 700, right: 700 } } };

(async () => {
  const sections = [
    { properties: { page: portrait.page }, children: cover },
    { properties: portrait, headers: { default: header }, footers: { default: footer("InspectFlow") }, children: [...toc, ...await bodyPart1(), H2("3. Use case diagram and ER diagram").constructor === Paragraph ? new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: "3. Use case diagram and ER diagram", font: FONT })] }) : null,
      H2("3.1 Actors"),
      table(["Actor", "Description", "Main permissions"], [
        ["Tester / Client Reviewer", "A person who tests the staging site and reviews builds. Role TESTER_CLIENT in a project.", "Report issues with the widget, follow and comment on own reports, verify or reopen fixes, review and approve builds shared with them"],
        ["Developer", "A team member who fixes problems. Role DEVELOPER.", "See all tickets and technical evidence, change status (start, resolve), assign, link branch and pull request, register builds and mark them ready"],
        ["Project Lead", "The owner of a project. Role LEAD.", "Everything a Developer can do, plus members and roles, widget key and allowed origins, GitHub connection, deleting data, verifying or reopening fixes"],
        ["GitHub", "Secondary system actor.", "Sends signed pull_request events to the webhook endpoint"],
      ], [2200, 3600, 3838]),
      P("A user's role is per project: the same person can be Lead in one project and Tester in another. There is no global administrator.", { para: { spacing: { before: 120, after: 120 } } }),
    ].filter(Boolean) },
    { properties: landscape, headers: { default: header }, footers: { default: footer("InspectFlow") }, children: [...await useCaseLand(), ...await erLand()] },
    { properties: portrait, headers: { default: header }, footers: { default: footer("InspectFlow") }, children: await bodyPart3() },
    { properties: portrait, headers: { default: header }, footers: { default: footer("InspectFlow") }, children: [...await bodyPart5(), ...await bodyPart6(), ...await bodyPart7(), ...await bodyPart8()] },
  ];

  const numbering = { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    ...["num", "obj", "jwt"].map((ref) => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] })),
  ] };

  const doc = new Document({
    creator: "InspectFlow project group",
    title: "InspectFlow Project Report (CSC4161)",
    description: "Project report following the CSC4161 sample report structure",
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: "2C55D1" }, paragraph: { spacing: { before: 260, after: 100 }, keepNext: true, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true, color: INK }, paragraph: { spacing: { before: 180, after: 80 }, keepNext: true, outlineLevel: 2 } },
      ],
    },
    numbering,
    sections,
  });
  const out = path.join(__dirname, "InspectFlow_Project_Report.docx");
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log("wrote", out, Math.round(fs.statSync(out).size / 1024), "KB");
})();
