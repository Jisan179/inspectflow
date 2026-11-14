# API reference

48 operations on 33 paths, taken from the running API's OpenAPI document (`GET /api/docs-json`). Interactive documentation with request schemas: **`/api/docs`** (Swagger UI, use *Authorize* with the access token).

Base URL (local): `http://localhost:5001`. All bodies are JSON except `POST /reports` (multipart).

**Access column.** *Public* needs nothing. *Member* means any role in that project. *Lead*, *Dev* and *Tester* mean the project role. *Widget* means the widget key plus an allowed origin (and, where stated, a widget token). Non-members always get `404`, never `403`, so other projects' existence is not revealed.

## Response and error format

Lists that support pagination return `{ "items": [...], "total": 42, "page": 1, "limit": 20 }`. For `GET /projects`, `GET .../members` and `GET .../builds` pagination is opt-in: without `page` or `limit` a plain array is returned.

Every error has the same shape and never contains a stack trace:

```json
{ "success": false, "statusCode": 409, "error": "Conflict",
  "message": "Cannot approve: 1 blocking ticket(s) are not verified yet",
  "path": "/builds/6f1.../decision", "timestamp": "2026-11-14T11:20:41.807Z" }
```

| Status | Used when |
| --- | --- |
| 200 / 201 | Success / resource created (POST actions such as status change also return 201) |
| 400 | Validation failed (the message names the field), unknown field, malformed JSON, bad query |
| 401 | Missing, invalid or expired token; wrong login; invalid webhook signature; bad widget key |
| 403 | Authenticated, but the project role does not allow it; origin not allowed for the widget |
| 404 | Not found, or not visible to you (other project, someone else's ticket, draft build for a client) |
| 409 | Duplicate (email, repository, member), workflow rule (blocking tickets, already decided build) |
| 413 / 415 | Screenshot too large / not a real PNG, JPEG or WebP |
| 429 | Rate limit exceeded |

## Auth and users

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/auth/register` | Create account, returns access and refresh tokens | Public (10 per minute) |
| POST | `/auth/login` | Sign in | Public (10 per minute) |
| POST | `/auth/refresh` | Exchange a refresh token (single use, rotated) | Public |
| POST | `/auth/logout` | Revoke a refresh token | Public |
| GET | `/auth/me` | Current user | Any signed-in user |
| GET | `/users/me` | Own profile | Any signed-in user |
| PATCH | `/users/me` | Change name or password (needs current password) | Any signed-in user |

## Projects, members, GitHub

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/projects` | Create project (creator becomes Lead; widget key returned once) | Any signed-in user |
| GET | `/projects` | Projects I belong to (opt-in pagination) | Any signed-in user |
| GET | `/projects/:projectId` | One project with my role | Member |
| PATCH | `/projects/:projectId` | Name, description, staging URL, allowed origins | Lead |
| DELETE | `/projects/:projectId` | Delete project, data and stored screenshots | Lead |
| POST | `/projects/:projectId/rotate-key` | New widget key (old one stops working) | Lead |
| GET | `/projects/:projectId/members` | List members (opt-in pagination) | Member |
| GET | `/projects/:projectId/members/:membershipId` | One member | Member |
| POST | `/projects/:projectId/members` | Add a registered user with a role | Lead |
| PATCH | `/projects/:projectId/members/:membershipId` | Change role (a project keeps one Lead) | Lead |
| DELETE | `/projects/:projectId/members/:membershipId` | Remove member | Lead |
| PATCH | `/projects/:projectId/github` | Connect `owner/repo`, set or generate webhook secret | Lead |
| GET | `/projects/:projectId/webhook-deliveries` | Delivery history (paged) | Lead, Dev |
| GET | `/projects/:projectId/overview` | Ticket counts, builds, approvals, activity | Lead, Dev |

## Tickets and comments

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/projects/:projectId/tickets` | Search, filter, sort, paginate | Member (Tester sees own reports only) |
| POST | `/projects/:projectId/tickets` | Create a ticket without screenshot | Member |
| GET | `/tickets/:ticketId` | Detail with signed screenshot URLs, comments, activity, allowed transitions | Member (Tester: own ticket, no technical events) |
| PATCH | `/tickets/:ticketId` | Title, description, severity, assignee, build | Lead, Dev |
| DELETE | `/tickets/:ticketId` | Delete ticket and its files | Lead |
| POST | `/tickets/:ticketId/status` | Change status (see workflow below) | By transition |
| POST | `/tickets/:ticketId/link` | Link a branch and/or pull request number | Lead, Dev |
| POST | `/tickets/:ticketId/duplicate` | Mark as duplicate of another ticket in the project | Lead, Dev |
| GET | `/tickets/:ticketId/comments` | Paged comments | Member who can see the ticket |
| POST | `/tickets/:ticketId/comments` | Add a comment or reply | Member who can see the ticket |
| PATCH | `/comments/:commentId` | Edit a comment | Author |
| DELETE | `/comments/:commentId` | Delete a comment | Author or Lead |

Query parameters for the list: `q` (title, description or `IF-12`), `status`, `severity`, `assigneeId` (`me`, `unassigned` or an id), `buildId`, `sort` (`createdAt`, `updatedAt`, `severity`, `status`, `number`), `order`, `page`, `limit` (1 to 100).

Status workflow (the single table is [ticket-workflow.ts](../apps/api/src/modules/tickets/ticket-workflow.ts)):

| From | To | Who |
| --- | --- | --- |
| Open | In progress, Resolved | Developer, Lead |
| In progress | Open, Resolved | Developer, Lead |
| Resolved | Verified, Open (reopen) | Tester/Client, Lead |
| Verified | Open (reopen) | Tester/Client, Lead |

The GitHub webhook also moves Open and In progress tickets to Resolved.

## Builds and approval

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/projects/:projectId/builds` | Builds with blocking-ticket counts (clients see only non-draft) | Member |
| POST | `/projects/:projectId/builds` | Register branch, commit SHA, preview URL (starts as Draft) | Lead, Dev |
| GET | `/projects/:projectId/approvals` | Approval history of the project | Lead, Dev |
| GET | `/builds/:buildId` | Build with approvals | Member (clients: not drafts) |
| PATCH | `/builds/:buildId` | Edit while Draft | Lead, Dev |
| DELETE | `/builds/:buildId` | Delete a Draft or Rejected build | Lead |
| POST | `/builds/:buildId/ready` | Share with clients: Draft to In review | Lead, Dev |
| GET | `/builds/:buildId/review` | Blocking and open tickets, decision history, `canApprove` | Member (clients: not drafts) |
| POST | `/builds/:buildId/decision` | `APPROVED` or `CHANGES_REQUESTED` with note | Tester/Client only |

A build with a High or Blocker ticket that is not yet Verified cannot be approved (409). The approval stores the build's commit SHA at that moment.

## Widget and webhook

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/widget/config` | Project name and the list of what the widget captures | Widget key + allowed origin |
| POST | `/widget/login` | Tester sign-in, returns a 2 hour token valid for this project's widget only | Widget key + allowed origin |
| POST | `/reports` | Create a ticket: multipart fields `payload` (JSON) and `screenshot` (PNG, JPEG or WebP, 5 MB max) | Widget key + origin + widget token |
| POST | `/webhooks/github` | GitHub `pull_request` events; `X-Hub-Signature-256` is verified over the raw body | HMAC signature |

Request headers for widget routes: `X-InspectFlow-Key: if_pk_...`, `Origin` (sent by the browser), `Authorization: Bearer <widget token>` for `/reports`.

`POST /reports` payload fields: `description` (required), `severity`, `title`, `pageUrl`, `viewport` (`1280x720`), `userAgent`, `buildId`, `events[]` (type `CONSOLE`, `NETWORK` or `ERROR`, url, method, statusCode, durationMs, message, stack, timestamp; at most 200, sanitised server side), `annotations[]` (type `ARROW`, `BOX` or `BLUR` with `shapeJson`).

## Health

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/health` | `{status, database, time}`; 503 if the database is down | Public |
| GET | `/` | Name and links | Public |
