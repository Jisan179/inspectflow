# Test execution report

Results below were produced on 14 November 2026 on the development machine (Windows 11, Node 26 alpha, PostgreSQL 17.11). Nothing in this file is estimated: counts come from Jest's JSON output and from commands run in this session.

## Summary

| Area | Result |
| --- | --- |
| API unit and integration tests (Jest, real PostgreSQL) | **162 passed, 0 failed** in 12 suites |
| Widget tests (Jest, jsdom) | **21 passed, 0 failed** in 3 suites |
| Scripted end-to-end workflow (`scripts/demo-flow.mjs`, real HTTP) | **21 of 21 checks passed** |
| Type-check API, widget, web (`tsc --noEmit`) | 0 errors |
| ESLint (API) | 0 errors, 1 warning |
| Production builds: API (`nest build`), web (`next build`), widget, staging | all succeed |
| Manual browser run through the real UI (built-in browser pane) | passed, see below |

## What each suite covers

API (`apps/api`), 162 tests:

| File | Tests | Covers |
| --- | --- | --- |
| `test/auth.e2e-spec.ts` | 14 | register, bcrypt hash stored, duplicate 409, validation 400 with field names, unknown-field rejection, login, identical 401 for wrong password and unknown email, 401 without or with a tampered token, refresh rotation and reuse, logout revocation, profile and password change, health, Helmet headers |
| `test/projects-authz.e2e-spec.ts` | 19 | Lead on create, key shown once and stored hashed, origin validation, **cross-project isolation** (list, reads, writes, foreign membership id all 404), role permissions (Lead only for settings, members, key rotation, GitHub), last-Lead protection, key rotation, GitHub connect and unique repo, project deletion |
| `test/tickets.e2e-spec.ts` | 23 | sequential ticket numbers, validation, **full lifecycle with role checks**, no skipping steps, reopen, activity history, tester sees only own tickets, technical evidence hidden from testers, assignment rules, git linking validation, duplicates within one project, comments, stored-XSS text kept inert, search, filters, sort, pagination, invalid query rejection |
| `test/reports.e2e-spec.ts` | 20 | project key and origin checks (401, 403), CORS preflight, widget sign-in and token scope, **ticket created with sanitised evidence**, screenshot private storage, signed URL success, tampered signature, expiry, path traversal, missing file, wrong MIME, fake image, JPEG as PNG, over 5 MB, payload validation, orphan cleanup, build association, key rotation lockout, files deleted with the project |
| `test/github.e2e-spec.ts` | 14 | **invalid, missing and malformed signatures return 401**, tampered body, unknown repository, ping, merge resolves by PR number, branch to PR link to merge to verify flow, closed without merge ignored, other projects untouched, **replayed delivery ignored**, delivery history |
| `test/builds.e2e-spec.ts` | 16 | build registration and validation, drafts hidden from clients, **approval blocked by High/Blocker tickets**, resolved-but-unverified still blocks, approval stores the commit, double decision 409, **two simultaneous decisions give one record**, request changes needs a note, only Tester/Client may decide, cross-project 404 |
| `test/crud-extras.e2e-spec.ts` | 13 | ticket delete removes files, comment list/edit/delete rules, build delete rules, member by id, opt-in pagination, `X-Response-Time`, **transaction rollback** (decision and ticket creation) and **screenshot retention** |
| `test/rate-limit.e2e-spec.ts` | 2 | login and widget routes answer 429 after the limit |
| `src/common/utils/sanitize.spec.ts` | 19 | bearer tokens, JWTs, password/api-key/cookie values, sensitive query params, credentials and fragments in URLs, event normalisation, caps |
| `src/modules/github/github-signature.spec.ts` | 6 | HMAC format, **GitHub's published test vector**, wrong secret, modified body, malformed headers |
| `src/modules/files/image.service.spec.ts` | 8 | magic-byte detection, valid PNG re-encoded, missing file, wrong MIME, text renamed `.png`, JPEG claiming PNG, size limit, corrupt image |
| `src/modules/tickets/ticket-workflow.spec.ts` | 8 | every role/transition rule, blocking definition |

Widget (`apps/widget`), 21 tests:

| File | Tests | Covers |
| --- | --- | --- |
| `test/redact.test.ts` | 7 | **irreversible blur**: pixels outside untouched, original pixels destroyed (under 2 percent coincide on random data), uniform blocks, many-to-one proof (two different images give identical output), clamping, block size |
| `test/collector.test.ts` | 9 | console.error recorded and still printed, uncaught errors and rejections, failed fetch (HTTP error and network failure) recorded while successes are not, **headers, cookies and bodies never recorded**, widget's own API calls ignored, failed XHR, rolling buffer bound, uninstall restores originals |
| `test/ring-sanitize.test.ts` | 5 | rolling buffer, client-side redaction |

## Real-browser verification (manual, not an automated suite)

Performed with the built-in browser pane against the locally running stack (API on 5001, dashboard on 3000, demo staging site on 4000):

1. Opened the staging site; the widget mounted and showed *Report issue*.
2. Triggered the four demo defects with real clicks (dead button, failing order request, console error, 404 request).
3. Opened the widget, which called the API across origins (key and origin checks passed), signed in as the demo tester and captured the page with html2canvas.
4. Drew an arrow, a box and a blur region with mouse events; Undo and Redo toggled correctly.
5. Sent the report as ticket IF-4. The database held the correct severity, viewport, URL, three annotations and four events. The `token` query value and `Authorization` header from the page were **not present**; the uncaught `TypeError` carried its stack and source line.
6. Downloaded the stored PNG: the blurred promo-code area contained **91 distinct colours across 49,288 pixels** (large flat blocks); the original text is not recoverable from the file.
7. Signed in to the dashboard as the developer; the ticket showed the annotated screenshot (private signed URL), the evidence viewer and the environment panel; *Start work* changed the status.
8. Ran `scripts/demo-flow.mjs` (below) and opened the client's review page, which showed the approved build, commit SHA, approver and note.
9. Checked the phone-width layout (375 px) of the review page.

### Scripted workflow (`node scripts/demo-flow.mjs`)

21 checks: connect repository; approval refused while 2 blocking tickets exist (409); link branches; signed `opened` and `closed (merged)` webhooks resolve the tickets; replayed delivery ignored; invalid signature gets 401; resolved tickets still block until the tester verifies; developer cannot approve (403); client approves; approval stored against commit `9f8e7d6c5b...` and visible in the Lead's history.

**Important:** the webhook calls in this script are real HMAC-signed HTTP requests built by the script. They do **not** come from github.com. A merge on a real GitHub repository has not been tested (it needs your repository; see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Production smoke test (14 November 2026, after deployment)

The stack was deployed (Vercel + Render + Supabase, see [DEPLOYMENT.md](DEPLOYMENT.md)) and a **read-only** smoke test passed **21 of 21 checks** against the live services: all five public pages served; API health with database up; all four demo accounts log in; the seeded project, 3 tickets and 2 builds are visible with the correct role filtering (tester sees only own reports and gets 403 on the overview); ticket IF-1 returns its 2 sanitised events and a **private screenshot downloaded from Supabase storage via a signed URL** (PNG verified, which confirms the S3 driver end to end); the widget endpoint accepts the demo key from the staging origin and refuses a foreign origin with 403. The mutating workflow script was deliberately not run in production so the seeded demo state stays fresh for the supervisor.

## Not tested, and why

| Item | Status |
| --- | --- |
| A real GitHub webhook from a real merge | Not done. Needs a repository, a public API URL and your authorisation. |
| Public deployment (Vercel, Render, Supabase) | **Done and verified** (see the production smoke test above). |
| S3 driver against a real bucket | **Verified in production**: seed uploads plus a signed-URL download from the private Supabase bucket. |
| Automated browser tests (Playwright) | Not written. The widget flow was verified manually as described above. |
| Load or performance tests | Not run. Typical local response times are 20 to 60 ms (`X-Response-Time`), no measured evidence at scale. |
| Safari, Firefox, mobile browsers | Only Chromium (the pane's engine) was used. |
| `docker-compose.yml` | Written but not run (Docker is not installed on this machine). |
| Screen reader and keyboard-only audit | Not performed; labels, roles and focus styles were added but not audited. |

## Reproduce

```bash
pnpm --filter @inspectflow/api migration:run      # test database: set TEST_DATABASE_URL if needed
pnpm test                                         # API: 162 tests
pnpm --filter @inspectflow/widget test            # widget: 21 tests
node scripts/demo-flow.mjs                        # after a fresh seed, with the API running
```
