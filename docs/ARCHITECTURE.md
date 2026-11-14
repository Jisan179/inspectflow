# Architecture

InspectFlow is a three-tier web application (proposal section 12). The dashboard and the embeddable widget both talk to one NestJS REST API, which reads and writes PostgreSQL and a private S3-compatible bucket. GitHub calls the API through a signed webhook.

## System diagram

```mermaid
flowchart LR
  subgraph Browser
    D[Dashboard<br/>Next.js]
    subgraph Staging site
      W[Widget<br/>html2canvas + Konva]
    end
  end
  GH[GitHub]
  subgraph Server
    API[NestJS API<br/>Passport JWT, guards,<br/>validation, Swagger]
  end
  DB[(PostgreSQL<br/>Prisma)]
  S3[(Private S3 bucket<br/>screenshots)]

  D -- "HTTPS, Bearer JWT" --> API
  W -- "HTTPS, project key + origin check<br/>+ widget token" --> API
  GH -- "webhook, HMAC-SHA256" --> API
  API --> DB
  API -- "put / delete" --> S3
  D -. "short-lived signed URL (image)" .-> S3
```

## Report-to-approval sequence

```mermaid
sequenceDiagram
  actor T as Tester
  participant W as Widget
  participant A as API
  participant DB as PostgreSQL
  participant S as Storage
  actor Dev as Developer
  participant GH as GitHub
  actor C as Client

  T->>W: click "Report issue", sign in
  W->>A: POST /widget/login (key + origin)
  A-->>W: project-scoped token (2 h)
  W->>W: html2canvas screenshot, collected errors
  T->>W: draw arrows/boxes, blur, describe
  W->>W: flatten + irreversibly pixelate blur regions
  W->>A: POST /reports (multipart: payload + PNG)
  A->>A: key, origin, token, size, MIME + magic bytes
  A->>A: sanitise events, re-encode PNG with Sharp
  A->>S: store PNG under random key
  A->>DB: ticket + events + annotations + artifact (one transaction)
  Dev->>A: open ticket, link branch (JWT)
  GH->>A: pull_request merged (signed)
  A->>A: verify HMAC, ignore replayed delivery id
  A->>DB: ticket to Resolved + delivery record (one transaction)
  T->>A: verify the fix
  C->>A: approve build (blocked while High/Blocker tickets are unverified)
  A->>DB: approval with commit SHA, build to Approved (locked transaction)
```

## Entity relationship diagram

Matches [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma). `RefreshToken` and `ActivityLog` are supporting tables not listed in the proposal.

```mermaid
erDiagram
  USER ||--o{ MEMBERSHIP : has
  PROJECT ||--o{ MEMBERSHIP : has
  PROJECT ||--o{ BUILD : owns
  PROJECT ||--o{ TICKET : owns
  PROJECT ||--o{ WEBHOOK_DELIVERY : receives
  PROJECT ||--o{ ACTIVITY_LOG : records
  BUILD ||--o{ TICKET : groups
  BUILD ||--o{ BUILD_APPROVAL : "decided by"
  USER ||--o{ BUILD_APPROVAL : makes
  USER ||--o{ TICKET : "reports"
  USER |o--o{ TICKET : "assigned to"
  TICKET ||--o{ ANNOTATION : has
  TICKET ||--o{ ARTIFACT : has
  TICKET ||--o{ CAPTURED_EVENT : has
  TICKET ||--o{ COMMENT : has
  USER ||--o{ COMMENT : writes
  TICKET |o--o{ TICKET : "duplicate of"
  USER ||--o{ REFRESH_TOKEN : owns
  TICKET |o--o{ ACTIVITY_LOG : "history of"

  USER { uuid id PK
         string email UK
         string passwordHash }
  PROJECT { uuid id PK
            string apiKeyPrefix UK
            string apiKeyHash
            string[] allowedOrigins
            string githubRepo UK
            string webhookSecret
            int nextTicketNo }
  MEMBERSHIP { uuid id PK
               uuid userId FK
               uuid projectId FK
               enum role "TESTER_CLIENT|DEVELOPER|LEAD" }
  BUILD { uuid id PK
          string branch
          string commitSha
          enum status "DRAFT|IN_REVIEW|APPROVED|REJECTED" }
  BUILD_APPROVAL { uuid id PK
                   enum decision "APPROVED|CHANGES_REQUESTED"
                   string commitSha
                   datetime decidedAt }
  TICKET { uuid id PK
           int number "unique per project"
           enum severity "LOW|MEDIUM|HIGH|BLOCKER"
           enum status "OPEN|IN_PROGRESS|RESOLVED|VERIFIED"
           string branch
           int prNumber }
  ANNOTATION { uuid id PK
               enum type "ARROW|BOX|BLUR"
               json shapeJson }
  ARTIFACT { uuid id PK
             string storageKey UK
             string mimeType
             int sizeBytes }
  CAPTURED_EVENT { uuid id PK
                   enum type "CONSOLE|NETWORK|ERROR"
                   string url
                   int statusCode }
  COMMENT { uuid id PK
            string body }
  WEBHOOK_DELIVERY { uuid id PK
                     string deliveryId UK
                     boolean signatureValid }
```

Key constraints: `Membership (userId, projectId)` unique; `Ticket (projectId, number)` unique; `WebhookDelivery.deliveryId` unique (replay protection); `Project.apiKeyPrefix` and `githubRepo` unique. Deleting a project cascades to everything it owns; deleting a build only clears `Ticket.buildId`; users referenced by tickets, comments or approvals cannot be deleted (`RESTRICT`) so the audit trail stays intact.

## Request pipeline (API)

```
request
  -> Helmet, CORS (dashboard origins; widget routes answer any origin, then check per project)
  -> RequestLoggerMiddleware (method, path, status, duration; no query strings)
  -> JwtGuard            (global; skipped for routes marked @Public)
  -> ProjectRolesGuard   (global; any route with :projectId needs membership, @ProjectRoles narrows it)
  -> ThrottlerGuard      (rate limits; stricter on login and widget routes)
  -> ValidationPipe      (whitelist + forbidNonWhitelisted, class-validator DTOs)
  -> controller -> service -> Prisma / storage
  -> TimingInterceptor   (X-Response-Time)
  -> AllExceptionsFilter (one error shape, no stack traces, Prisma errors mapped to 404/409)
```

## Folder structure

```
inspectflow/
  apps/
    api/                          NestJS backend
      prisma/                     schema.prisma, migrations/, seed.ts
      src/
        main.ts, app.module.ts, app.setup.ts, app.controller.ts (health)
        config/                   Zod-validated environment
        common/                   decorators, guards, filters, interceptors, middleware, utils
        providers/                database (Prisma), storage (local + S3)
        modules/
          auth/ users/            registration, login, refresh, profile
          access/                 ProjectAccessService + ProjectRolesGuard (permissions)
          projects/               projects, members, widget key, GitHub connection, overview
          builds/                 builds and client approval
          tickets/                tickets, workflow rules, comments
          reports/                widget endpoints (key + origin guard, login, ingest)
          files/                  image validation, signed local files, retention
          github/                 webhook handling
          activity/               activity history and audit log
      test/                       integration tests and helpers
    web/                          Next.js dashboard (App Router)
      src/app/                    pages; src/components/ui.tsx; src/lib/ (api, auth, types)
    widget/                       embeddable widget (collector, editor, redaction, UI)
    staging/                      demo shop with deliberate defects
  scripts/                        demo-flow.mjs, local-db.ps1
  docs/                           this documentation
```

The layout follows the instructor's `user-management` project: modules with controller, service and DTOs, `common/` for guards, decorators and filters, `config/` for environment, `providers/` for infrastructure, and `@/` path aliases.
