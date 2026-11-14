# InspectFlow

**Visual Staging QA, Bug Annotation and PR Sign-Off Hub.** A tester clicks *Report issue* on a staging website, draws on a screenshot, and a developer receives a ticket with the page URL, browser, screen size, console errors and failed network requests already attached. Tickets link to Git branches, resolve themselves when the pull request merges on GitHub, and the client finally approves a specific build commit.

This is a university software engineering project (CSC4161). The design follows `InspectFlow_Project_Proposal.docx`; the course constraints come from the *Project Guide*. Marker.io was studied only for product and UX inspiration. All code, branding and artwork are original.

| Part | Folder | Technology |
| --- | --- | --- |
| REST API | [apps/api](apps/api) | NestJS 11, Prisma, PostgreSQL, Passport JWT, class-validator, Swagger, Throttler, Sharp |
| Dashboard | [apps/web](apps/web) | Next.js 15, React 19, TypeScript, Tailwind CSS 4, SWR, Zod |
| Embeddable widget | [apps/widget](apps/widget) | TypeScript, html2canvas, Konva, esbuild |
| Demo staging site | [apps/staging](apps/staging) | Plain HTML/JS with deliberate test defects and the widget embedded |
| Scripts | [scripts](scripts) | End-to-end demo workflow runner |
| Documents | [docs](docs) | Architecture, compliance matrix, test report, guides |

## Documentation map

| Need | Read |
| --- | --- |
| Understand how it fits together, ER diagram | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Explain each module in the defense | [docs/CORE_MODULES.md](docs/CORE_MODULES.md), [docs/DEFENSE_QA.md](docs/DEFENSE_QA.md) |
| Show the supervisor the product | [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| Check requirements are met | [docs/COMPLIANCE.md](docs/COMPLIANCE.md) |
| See what was really tested | [docs/TEST_REPORT.md](docs/TEST_REPORT.md) |
| Honest list of gaps | [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) |
| Put it online for free | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Every endpoint | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) and Swagger at `/api/docs` |
| Compare with Marker.io | [docs/MARKER_COMPARISON.md](docs/MARKER_COMPARISON.md) |

## Prerequisites

- Node.js 22 or newer (`.nvmrc` says 22)
- pnpm 12 (`npm install -g pnpm`)
- PostgreSQL 15 or newer (a local install, or `docker compose up -d` using [docker-compose.yml](docker-compose.yml))
- VS Code (recommended extensions: ESLint, Prettier, Prisma)

## Quick start (local)

```bash
# 1. Install everything (one command for all four apps)
pnpm install

# 2. Create the API configuration
cp apps/api/.env.example apps/api/.env
#    then edit DATABASE_URL and the two JWT secrets (see "Environment variables")

# 3. Create the databases (replace the user as needed)
createdb inspectflow
createdb inspectflow_test        # only needed for the tests

# 4. Create tables and load demo data
pnpm --filter @inspectflow/api migration:run
pnpm --filter @inspectflow/api seed

# 5. Build the widget (also copies it into the web and staging apps)
pnpm build:widget
```

Open three terminals in VS Code (Terminal, Split) and run one command in each:

```bash
pnpm dev:api       # http://localhost:5001   (Swagger: /api/docs, health: /health)
pnpm dev:web       # http://localhost:3000   (dashboard)
pnpm dev:staging   # http://localhost:4000   (demo shop with the widget)
```

Sign in at http://localhost:3000/login. The *Demo accounts* box fills the form for you.

| Role | Email | Password |
| --- | --- | --- |
| Project Lead | lead@inspectflow.demo | `Demo@12345` |
| Developer | dev@inspectflow.demo | `Demo@12345` |
| Tester / Client | tester@inspectflow.demo | `Demo@12345` |
| Tester / Client | client@inspectflow.demo | `Demo@12345` |

These accounts are fictional and exist only after running the seed. **Never run the seed against a database that holds real data**, and change or remove these users on any public deployment you keep (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

### Database note for this machine

During development a private PostgreSQL instance was created inside the project folder (`.pgdata`, port 5433) so that your existing PostgreSQL service and its password were never touched. `apps/api/.env` already points to it. It stops when the computer restarts; start it again with:

```powershell
powershell -File scripts/local-db.ps1 start
```

If you prefer your own PostgreSQL, create a database and put its URL into `DATABASE_URL`.

## Environment variables (API)

All variables are validated at start-up with Zod ([apps/api/src/config/app.config.ts](apps/api/src/config/app.config.ts)); a missing secret stops the server with a clear message. Template: [apps/api/.env.example](apps/api/.env.example).

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | required |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing keys, at least 16 characters | required |
| `JWT_ACCESS_TTL`, `REFRESH_TTL_DAYS` | Access token lifetime, refresh token days | `15m`, `7` |
| `PORT` | HTTP port | `5001` |
| `CORS_ORIGINS` | Dashboard origins allowed to call the API (comma separated) | `http://localhost:3000` |
| `PUBLIC_API_URL` | Public URL of the API (used in signed file links and webhook URL) | `http://localhost:5001` |
| `FRONTEND_URL` | Dashboard URL | `http://localhost:3000` |
| `STORAGE_DRIVER` | `local` (disk, development) or `s3` | `local` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | S3-compatible bucket settings | see template |
| `SIGNED_URL_TTL_SECONDS` | Lifetime of screenshot links | `300` |
| `WIDGET_MAX_PAYLOAD_KB`, `WIDGET_RATE_LIMIT_PER_MIN`, `AUTH_RATE_LIMIT_PER_MIN` | Request size and rate limits | `2048`, `20`, `10` |
| `SCREENSHOT_RETENTION_DAYS` | Delete screenshots of verified tickets after N days (0 keeps them) | `0` |

Web app (`apps/web/.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL`, optional `NEXT_PUBLIC_SHOW_DEMO=false` to hide the demo-account box.
Staging site: `WIDGET_KEY`, `API_URL` at build time (see [apps/staging/.env.example](apps/staging/.env.example)).

## Everyday commands

| Task | Command |
| --- | --- |
| Run all API tests (needs the `inspectflow_test` database) | `pnpm test` |
| Run widget tests | `pnpm --filter @inspectflow/widget test` |
| Type-check and lint everything | `pnpm lint` |
| Production builds | `pnpm build` |
| New migration after editing `schema.prisma` | `pnpm --filter @inspectflow/api migration:dev` |
| Apply migrations (CI and production) | `pnpm --filter @inspectflow/api migration:run` |
| Reset demo data | `pnpm --filter @inspectflow/api seed` |
| Run the scripted demo workflow | `node scripts/demo-flow.mjs` |
| Delete old screenshots (retention) | `pnpm --filter @inspectflow/api retention` |
| Start the compiled API | `pnpm --filter @inspectflow/api build && pnpm --filter @inspectflow/api start:prod` |

## How the widget is embedded

```html
<script src="https://YOUR-DASHBOARD/inspectflow-widget.js"
        data-key="if_pk_xxxxxxxx"
        data-api="https://YOUR-API"
        defer></script>
```

The project key is shown once when the project is created (and again after a rotation). It is a public identifier, so security relies on the allowed-origin list, rate limits, payload limits and the tester sign-in. See [docs/CORE_MODULES.md](docs/CORE_MODULES.md).

## Status

**Deployed and verified on 14 November 2026.** A read-only production smoke test passed 21 of 21 checks (see [docs/TEST_REPORT.md](docs/TEST_REPORT.md)).

| What | URL |
| --- | --- |
| Dashboard (sign in here) | https://inspectflow-web-seven.vercel.app |
| Demo staging site (report bugs here) | https://inspectflow-staging.vercel.app |
| API with Swagger docs | https://inspectflow-api.onrender.com/api/docs |

The free API sleeps after 15 minutes of inactivity; the first request can take up to a minute. Open the API health URL a few minutes before a demo. Still outstanding: a merge on a real GitHub repository has not been exercised (webhook handling is tested with signed requests only).

Details and caveats: [docs/COMPLIANCE.md](docs/COMPLIANCE.md) and [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).
