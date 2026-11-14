# Compliance and traceability

Status words used: **Verified** = covered by an automated test or a recorded manual run (see [TEST_REPORT.md](TEST_REPORT.md)). **Implemented** = built and type-checked but not independently verified. **Not done** = absent. **External** = needs your accounts or authorisation.

## 1. Conflict decisions

| Conflict | Decision and consequence |
| --- | --- |
| Proposal says **Prisma**; instructor taught **TypeORM**; the Project Guide "assumes NestJS with TypeORM" but says the same requirements apply with the equivalent tools if the instructor accepts another stack. | Prisma is used, as the proposal states. It meets the guide's "relational database accessed through an ORM, relations, foreign keys, migrations, transactions" wording. **Action for you:** confirm with your instructor that Prisma is acceptable. If not, the data layer would have to be rewritten with TypeORM entities (roughly the services and `prisma/`); the controllers and DTOs would stay. |
| Proposal lists Konva in the "Frontend app" row. | The Konva editor lives in the **widget** because that is where the screenshot is taken (the staging site, not the dashboard). The dashboard only displays annotated images. Behaviour matches the proposal's journey. |
| Proposal says "S3 / Uploadthing". | S3-compatible storage only (Uploadthing not used). |
| Brief says "Redis and Bull only if justified". | Not used. There is no background work that needs a queue; rate limiting uses the in-memory Throttler. |
| Instructor code uses `argon2`; proposal and guide say bcrypt. | bcrypt, as required by the proposal and the guide. |
| Guide says a frontend is not required. | A frontend was built because the brief asks for a client-ready product. All requirements are still reachable through Swagger. |

## 2. Proposal traceability

### Objectives (section 7)

| # | Objective | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Widget captures viewport, user agent, console errors, failed fetch/XHR and submits with a screenshot | Verified | `apps/widget/test/collector.test.ts`; real-browser run produced ticket IF-4 with every field and no manual entry |
| 2 | Annotation editor with arrows, boxes, blur; stored image has no original pixels | Verified | `redact.test.ts`; stored PNG blur region had 91 distinct colours over 49,288 pixels |
| 3 | Ticket lifecycle with role permissions; roles cannot read other projects | Verified | `ticket-workflow.spec.ts`, `tickets.e2e-spec.ts`, `projects-authz.e2e-spec.ts` |
| 4 | Merged PR resolves the ticket; invalid signature gets 401 | Verified with signed test requests. **External** for a real GitHub merge | `github.e2e-spec.ts`, `github-signature.spec.ts`, `scripts/demo-flow.mjs` |
| 5 | Client sees and approves only shared builds; tokens/cookies removed from logs; invalid files rejected | Verified | `builds.e2e-spec.ts`, `sanitize.spec.ts`, `reports.e2e-spec.ts`, `image.service.spec.ts` |

### Scope and screens (sections 8 and 10)

| Item | Status | Where |
| --- | --- | --- |
| Authentication, per-project roles | Verified | `modules/auth`, `modules/access`; `/login`, `/register` |
| Project, member and build management | Verified | `modules/projects`, `modules/builds`; project Settings, Members, Builds pages |
| 10.1 Sign in and project list | Verified | `/app/projects` |
| 10.1 Staging site with widget (button, screenshot, description, severity) | Verified (manual) | `apps/staging`, `apps/widget` |
| 10.1 Annotation editor: arrows, boxes, blur, undo, redo | Verified (manual + unit) | `apps/widget/src/editor.ts` |
| 10.1 My reports: status, replies, comment, verify or reopen | Verified | project "My reports" tab, ticket page |
| 10.1 Build review page: summary, open tickets, approve or request changes with note | Verified | `/app/builds/:id` |
| 10.1 Notifications: email on status change (Optional) | **Not done** | would need an SMTP service; listed as future work |
| 10.2 Ticket dashboard: filter by project, build, status, severity, assignee; sort, search | Verified | ticket list (project is the page scope) |
| 10.2 Ticket detail: annotated screenshot, environment, console errors, failed-request viewer, status, comment | Verified | `/app/tickets/:id` |
| 10.2 Branch / PR linking, automatic status change after merge | Verified (signed requests) | ticket Triage card, `modules/github` |
| 10.2 Build management: register and mark ready | Verified | Builds tab |
| 10.2 Duplicate marking (Optional) | Verified (API); no dashboard button | `POST /tickets/:id/duplicate` |
| 10.3 Project settings: create, rotate key, allowed domains | Verified | Settings tab |
| 10.3 Member management | Verified | Members tab |
| 10.3 GitHub connection: repository, secret, delivery history | Verified | Settings tab |
| 10.3 Overview report (Optional): counts, approval history, activity | Verified | Overview tab |
| 10.4 Widget button and panel, authenticates with project key | Verified | `apps/widget/src/ui.ts` |
| 10.4 Background collector with rolling buffer and secret removal | Verified | `collector.ts`, `ring-buffer.ts` |
| File upload validation, signed URLs, log sanitisation | Verified | `image.service.ts`, `storage.service.ts`, `sanitize.ts` |

### Modules (section 12)

| Module | Status | Notes |
| --- | --- | --- |
| Auth & Users (Passport, bcrypt) | Verified | |
| Projects & Memberships (guards, keys) | Verified | |
| Builds & Approvals | Verified | |
| Tickets & Comments (class-validator) | Verified | |
| Reports ingest (key, origin, rate limit, sanitise) | Verified | Throttler |
| Files (validation, storage, signed URLs, Sharp) | Verified for the local driver. **Implemented** for the S3 driver | Multer is used inside NestJS's `FileInterceptor` |
| GitHub integration (HMAC, map PR and branch to tickets) | Verified. The proposal also mentions the "GitHub API"; **no outbound GitHub API calls are made** (the webhook carries everything needed) | |
| Frontend app | Verified | |
| Capture widget | Verified | |

### Entities (section 13)

All 11 entities exist with the proposal's fields and relationships ([ARCHITECTURE.md](ARCHITECTURE.md)). Differences: `Build.name` and `Ticket.number`, `Ticket.duplicateOfId`, `Ticket.updatedAt`, `WebhookDelivery.outcome`, `BuildApproval.commitSha`, `Artifact.createdAt` were added for the features above; `RefreshToken` and `ActivityLog` are extra tables (refresh-token revocation, activity history and audit log). `BuildApproval.decision` uses `APPROVED` / `CHANGES_REQUESTED`.

### Security and privacy (section 14)

| Statement | Status | Evidence |
| --- | --- | --- |
| bcrypt passwords, short-lived JWT access plus refresh tokens | Verified | `auth.e2e-spec.ts` (hash format, rotation, logout) |
| Guard checks membership for every project request; queries filtered by project | Verified | `projects-authz.e2e-spec.ts` |
| Widget key stored hashed, allowed origins, rate limit, size limit, rotation | Verified | `reports.e2e-spec.ts`, `rate-limit.e2e-spec.ts` |
| class-validator DTOs, parameterised queries | Verified | validation tests; Prisma |
| Log sanitisation, plain-text storage, escaped rendering | Verified | `sanitize.spec.ts`; React renders text, never HTML |
| Uploads: size, MIME, magic bytes, random keys, private bucket, expiring URLs, blur applied before upload | Verified (local driver) | `image.service.spec.ts`, `reports.e2e-spec.ts` |
| Webhook HMAC and delivery-id replay protection | Verified | `github.e2e-spec.ts` |
| Tell the tester what is captured | Verified | widget panel lists it before sending |
| Delete data with the project | Verified | project deletion tests (rows and files) |
| HTTPS, restricted CORS, env secrets, audit logging of approvals and role changes | CORS, env secrets, audit log **Verified**. HTTPS **External** (provided by Vercel and Render once deployed) | |

## 3. Project Guide checklist (CSC4161)

### Minimum requirements (section 4): all five

| Requirement | Status | Evidence |
| --- | --- | --- |
| **Multiple entities with CRUD**: at least four related entities; create, list, get by id, update, delete; 201 on create, 404 when missing; paginated lists | Met | Projects (all five operations), Tickets (list, create, get, patch, delete), Builds (list, create, get, patch, delete), Comments (list, create, patch, delete), Members (list, get, create, patch, delete). Pagination: tickets, comments, webhook deliveries always; projects, members, builds opt-in. See [API_REFERENCE.md](API_REFERENCE.md) |
| **Database integration and a transaction that rolls back** | Met | PostgreSQL through Prisma with foreign keys and migrations. Transactions: ticket creation (counter, ticket, evidence, log), build decision (locked), webhook (delivery plus ticket updates). `crud-extras.e2e-spec.ts` forces a failure in the last step and proves the earlier steps are undone |
| **JWT auth and authorization**: register, login, bcrypt, protected routes, at least two roles with guards | Met | three project roles; 401 without token, 403 for the wrong role (`auth.e2e-spec.ts`, `projects-authz.e2e-spec.ts`) |
| **Input validation with DTOs**: separate create and update DTOs, global ValidationPipe stripping unknown fields, 400 naming the field | Met | `CreateProjectDto`/`UpdateProjectDto`, `CreateBuildDto`/`UpdateBuildDto`, `CreateTicketDto`/`UpdateTicketDto`; `whitelist` and `forbidNonWhitelisted` in `app.setup.ts` |
| **HTTP exception handling**: built-in exceptions, one error shape, no stack traces, duplicate key to 409 | Met | `AllExceptionsFilter`; 404, 409, 403 tests |

### Bonus requirements (section 5)

| Feature | Status | Where it is used |
| --- | --- | --- |
| Middleware | Built | `RequestLoggerMiddleware`: method, path, status, duration, request id; query strings dropped so tokens never reach logs |
| Custom decorators | Built | `@Public()`, `@CurrentUser()`, `@CurrentMembership()`, `@ProjectRoles(...)` |
| Mailer | **Not built** | optional e-mail notifications are future work |
| Swagger UI | Built | `/api/docs` with bearer auth; the Nest Swagger plugin infers DTO schemas |
| Interceptors | Built | `TimingInterceptor` sets `X-Response-Time` |
| Audit log | Built | `ActivityLog` records ticket changes, approvals, role changes, key rotation, GitHub connection |
| Env | Built | Zod-validated config, `.env.example` committed, no secrets in Git |
| Migrations | Built | Prisma migrations in `apps/api/prisma/migrations`; a fresh database is built only from them |
| Response manipulation | Built | password hashes, key hashes and webhook secrets never returned; pagination metadata |
| Database transaction (advanced) | Built | `SELECT ... FOR UPDATE` on the build row during approval; concurrent decisions produce exactly one record (tested) |

### Deliverables (sections 1 and 10)

| Item | Status |
| --- | --- |
| Working source in a Git repository with README, `.env.example`, migrations | Done. `git init` was run; **no commit has been made** (you asked to keep source control safe). Commits from every group member are for you and your team |
| Proposal (2 to 3 pages) | You already have `InspectFlow_Project_Proposal.docx` |
| Project report (docx or PDF), 7 parts: cover with AI-usage table, background, requirements, diagrams, normalization, API list, screenshots | **Not produced.** Material you can reuse: ER diagram ([ARCHITECTURE.md](ARCHITECTURE.md)), API list ([API_REFERENCE.md](API_REFERENCE.md)), requirements ([this file](COMPLIANCE.md)), test evidence ([TEST_REPORT.md](TEST_REPORT.md)). You must write the contribution and AI-usage table honestly yourself, and take the screenshots (including 401, 403, 400, 409 and a rollback) |
| Database normalization walk-through (UNF to 3NF) | Not written; the schema is in 3NF (every non-key column depends on the key, repeated user and project data lives in `User` and `Project`). The widget events table keeps one row per event, not repeating groups |
| Live demo | Local demo ready ([DEMO_SCRIPT.md](DEMO_SCRIPT.md)); public URL **External** |
| Every member can explain every module | Use [CORE_MODULES.md](CORE_MODULES.md) and [DEFENSE_QA.md](DEFENSE_QA.md) |

## 4. Brief's acceptance criteria

| Criterion | Status |
| --- | --- |
| Professional interface, frontend and backend integrated, PostgreSQL persistence | Done and verified in a browser |
| Project and member management, widget, screenshot capture and annotation, evidence | Done and verified |
| Complete lifecycle, GitHub PR linking and verified webhook, builds, client approval | Done and verified (webhook with signed test requests) |
| Secure screenshot storage | Local driver verified; S3 driver implemented |
| Demonstration staging site | Done |
| Reproducible local installation | Done ([README.md](../README.md)); Docker path unverified |
| Deployment-ready configuration | Done (`render.yaml`, Vercel settings, CI); **not deployed** |
| Verified public hosting | **Not done, External** |
| Test results and documentation | Done |
