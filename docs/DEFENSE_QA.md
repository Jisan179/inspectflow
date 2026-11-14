# Likely defense questions

Short, honest answers. Where the true answer is "not done", say so; examiners notice evasion more than gaps. File links are in [CORE_MODULES.md](CORE_MODULES.md).

## Product and design

**1. What problem does it solve and for whom?** Clients and non-technical testers report staging bugs as "the button isn't working", so developers lack the page, browser and error details. InspectFlow captures them automatically, links the ticket to the fixing pull request and records formal client sign-off on a specific commit.

**2. How is it different from Marker.io?** Same idea (visual feedback with technical context). InspectFlow adds a native ticket and project system instead of syncing to Jira, auto-resolves tickets on PR merge, requires verified fixes before build approval, and is free and self-hostable. It has no session replay, AI features or third-party integrations (see [MARKER_COMPARISON.md](MARKER_COMPARISON.md)).

**3. Why a Shadow DOM for the widget?** So the staging site's CSS cannot break the widget and the widget's CSS cannot break the site.

**4. Why does the tester have to sign in inside the widget?** The data model requires a reporter (`Ticket.reporterId`) and clients should be accountable for their reports. Anonymous reports are a possible extension.

## Security

**5. The widget key is public. Is that a problem?** No, it is an identifier like a Google Maps key, not a secret. It is stored hashed. What protects the API: the origin allow-list checked on the server, rate limits, payload and file limits, and the tester's sign-in. The key alone cannot read anything.

**6. Origin headers can be forged outside a browser. Is the origin check useless?** It stops other websites from using our key from visitors' browsers, which is the realistic threat for a public widget. A scripted attacker also needs valid tester credentials, so the origin check is defence in depth, not the only barrier. I state this limit in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

**7. How do you prove the blur cannot be undone?** `pixelate()` replaces each block with the average of its pixels, which is many-to-one. Test: two different images with the same block averages give the same output. In the real run, a stored screenshot's blurred region had 91 distinct colours over 49,288 pixels. Only the flattened PNG leaves the browser.

**8. How do you stop secrets in captured logs?** Both the widget and the server redact bearer tokens, JWTs, password/token/cookie style values and sensitive URL query parameters; the collector never records headers or bodies at all. `sanitize.spec.ts` and the widget collector tests cover it. Limit: free text with an unusual secret format can slip through.

**9. How do you prevent stored XSS?** Captured text is stored as plain data and React renders it as text, never as HTML. The tests store `<img onerror=...>` and confirm it is returned unchanged (escaped at render time). The widget builds its UI with `textContent`.

**10. How is the GitHub webhook authenticated?** `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256 of the **raw** body with the project secret, compared in constant time. We test against GitHub's published example vector. Invalid signature gives 401.

**11. How do you stop replays?** `WebhookDelivery.deliveryId` is unique and inserted in the same transaction as the ticket update; a second delivery of the same id violates the constraint, rolls back, and returns `duplicate: true`. (Redelivery from GitHub's UI is therefore harmless.)

**12. Why are non-members given 404 and not 403?** To avoid revealing which project or ticket ids exist.

**13. Why bcrypt, and why a refresh token?** bcrypt is slow and salted, and the proposal requires it. Short access tokens (15 minutes) limit damage from theft; refresh tokens are random, stored only as a hash, single use and revocable at logout.

**14. Where do you keep tokens in the browser, and what is the risk?** `localStorage`, which a successful XSS could read. Mitigations: no HTML injection paths, Helmet and a strict CSP on the API. A cookie-based design would be stronger but is harder across two free hosting domains.

**15. How are uploads validated?** Size (5 MB), declared MIME, magic bytes must match, then Sharp re-encodes to PNG (strips metadata, defeats polyglot files) with a pixel limit; the object key is a random UUID; the bucket is private and links expire in 5 minutes.

## Data and backend

**16. Why Prisma when the course taught TypeORM?** The proposal specifies Prisma. It satisfies the guide's ORM, relations, migrations and transaction requirements. If the instructor requires TypeORM, the data access in the services is the part to replace. I flagged this in [COMPLIANCE.md](COMPLIANCE.md).

**17. Show a transaction that rolls back.** Ticket creation increments the project counter, inserts the ticket and evidence, and logs activity. `crud-extras.e2e-spec.ts` forces the last step to fail and checks that no ticket exists and the counter did not advance. The build decision test does the same for approval records.

**18. How do you prevent two people approving at once?** `SELECT ... FOR UPDATE` on the build row inside the transaction. Three parallel decisions in the test produce exactly one approval record.

**19. How do ticket numbers stay unique per project?** `Project.nextTicketNo` is incremented inside the ticket transaction (the update takes a row lock) and `(projectId, number)` is a unique index.

**20. What is normalised in the schema?** Users, projects, memberships (many-to-many with a role attribute), builds, tickets, and child tables for annotations, artifacts, events and comments; no repeating groups, and each non-key column depends on its table's key (3NF). Denormalised on purpose: `BuildApproval.commitSha`, so the sign-off remains true after the build changes.

**21. What indexes exist?** Foreign keys that are filtered often (`projectId`, `buildId`, `assigneeId`), `(projectId, status)`, `(projectId, severity)`, `(projectId, branch)`, `(projectId, prNumber)`, plus unique indexes listed in [ARCHITECTURE.md](ARCHITECTURE.md).

**22. How would you scale it?** The API is stateless (JWT), so several instances can run behind a load balancer; move the Throttler store to Redis, serve images straight from the bucket (already so), and add a queue for notifications if they are built.

## Testing and honesty

**23. What exactly did you test?** 162 API tests against a real PostgreSQL (auth, per-project permissions, cross-project access, the ticket lifecycle, uploads, widget ingest, webhook signature and replay, approvals, transactions, retention, rate limits), 21 widget tests, a 21-check scripted workflow, and a manual real-browser run. Details and the list of what was **not** tested are in [TEST_REPORT.md](TEST_REPORT.md).

**24. Did you test a real GitHub merge?** Not yet. The signed requests are real HTTP requests with a correct HMAC, but they were produced by my script. A merge on a real repository needs a public API URL; steps are in [DEPLOYMENT.md](DEPLOYMENT.md).

**25. Is it deployed?** Not at the time of writing. The configuration is ready and the steps need my own accounts.

**26. What did AI do and what did you do?** Answer truthfully for your team and put the percentage in the report's AI-usage table, as the guide requires. You must be able to explain every file you submit; use [CORE_MODULES.md](CORE_MODULES.md) to study.

## Questions to practise live

- Open `ticket-workflow.ts` and explain why a Developer cannot verify.
- Open `github.service.ts` and walk through one delivery from signature check to ticket update.
- Open `redact.ts` and explain why the original pixels are gone.
- Open `builds.service.ts#decide` and explain the lock.
- Open `project-roles.guard.ts` and explain how a route gets membership checks without repeating code.
