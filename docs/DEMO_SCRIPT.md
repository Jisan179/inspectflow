# Supervisor demonstration script

About 12 minutes. It walks the proposal's complete journey with the three roles. Use two browser windows: one for the **staging site** and one for the **dashboard** (a private window for the second account avoids sign-in clashes).

## Before you start

1. Reset the demo data: `pnpm --filter @inspectflow/api seed`.
2. Start `pnpm dev:api`, `pnpm dev:web`, `pnpm dev:staging`.
3. Open http://localhost:3000/login (dashboard) and http://localhost:4000 (staging).
4. If online: open `<api>/health` five minutes earlier so the free servers are awake.

All demo passwords: `Demo@12345`. The login page has a *Demo accounts* box that fills the form.

## The story

| # | Who | Do this | Say / show |
| --- | --- | --- | --- |
| 1 | Supervisor (as client) | On the staging site read the yellow banner, click **Pay now** (nothing happens), **Place order** (nothing visible), and **Apply promo code** after typing a code such as `SPRING-VIP-9921`. | "This is the WhatsApp problem: the client only sees that it does not work." The defects are deliberate test scenarios, not bugs in InspectFlow. |
| 2 | Tester | Click **Report issue** (bottom right). Point out the sign-in, then sign in as `tester@inspectflow.demo`. | The panel will list exactly what is captured; no passwords, cookies or request bodies. |
| 3 | Tester | In the annotation screen draw an **arrow** at Pay now, a **box** around the buttons, and **blur** the promo-code box. Use **Undo** and **Redo** once. Write "Pay now does nothing", severity **High**, **Send report**. | The preview already shows the blur. Only the flattened image is uploaded, the original never leaves the browser. Note the ticket number (IF-4). |
| 4 | Developer | In the dashboard sign in as `dev@inspectflow.demo`, project **Acme Shop (demo)**, Tickets. Open the new ticket. | Screenshot, environment (viewport, browser, URL), **Technical evidence**: the uncaught TypeError with stack, the console error, and the failed `POST /api/orders` 500. Point out that `?token=` is shown as `[REDACTED]`. |
| 5 | Developer | Click **Start work**, assign yourself, write a comment, enter branch `fix/pay-button` and **Save link**. | Activity history records each step with a name and time. |
| 6 | Developer | Builds tab: show *Sprint 2: checkout* (In review) with its blocking tickets. | The client cannot approve yet. |
| 7 | Merge | **With a real GitHub repository connected:** merge the pull request. **Without it** run `node scripts/demo-flow.mjs` (state this clearly: signed test requests, not github.com). | The ticket moves to **Resolved** by itself ("merged PR #..., ticket resolved automatically"). Settings, GitHub connection, shows the delivery history; a replayed or badly signed delivery is rejected. |
| 8 | Tester | Sign in as `tester@inspectflow.demo`, My reports, open the ticket, **Verify fix**. | Developers cannot verify their own fixes (try it: the button is not offered). |
| 9 | Client | Sign in as `client@inspectflow.demo`, Build review, open *Sprint 2: checkout*. Show blocking list. Try **Approve** while a blocking ticket is open (blocked), then after verification **Approve build** with a note and confirm. | The approval is stored with the **commit SHA**, the approver and the time. |
| 10 | Lead | Sign in as `lead@inspectflow.demo`: Overview (counts, approval history, activity), Members (roles), Settings (widget key, allowed origins, embed code, GitHub). | Permissions come from the project role; try a developer account on Settings: it is refused. |

## If the supervisor wants to try things

- **Wrong role:** log in as the developer and open `/app/projects/<id>/settings` or try to approve: refused.
- **Another project:** register a new user and open a project URL: "Project not found".
- **Bad upload:** in Swagger (`/api/docs`) the `POST /reports` route needs the widget key and origin; a text file renamed `.png` is rejected with 415.
- **Swagger:** `/api/docs` for every endpoint.

## Things that can go wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Widget says "Could not reach InspectFlow" | API not running or asleep, or wrong `data-api` | start/wake the API; rebuild the staging site with the right `API_URL` |
| 403 "origin not allowed" | staging URL not in the project's allowed origins | add it in Settings (or `DEMO_STAGING_ORIGINS` for the seed) |
| Screenshot blank in places | html2canvas limitation | expected, see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) |
| Ticket numbers do not start at 1 | demo data not reset | run the seed again |
| Image does not load in a ticket | signed link expired (5 minutes) | reload the page |
