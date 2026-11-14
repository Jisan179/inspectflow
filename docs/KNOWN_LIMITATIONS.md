# Known limitations

Read this before the supervisor demo so nothing is a surprise.

## Not finished or not verified

| # | Limitation | Impact | What to do |
| --- | --- | --- | --- |
| 1 | **No public deployment exists yet.** | The supervisor cannot open a link today. | Follow [DEPLOYMENT.md](DEPLOYMENT.md); it needs your Supabase, Render and Vercel accounts. |
| 2 | **A real GitHub merge was never tested.** Webhook tests use correctly signed requests built by the test code. | The HMAC check, replay protection and auto-resolve are proven, but GitHub's real payloads and delivery behaviour are not. | Create a test repository and follow section "Connect GitHub" in the deployment guide. |
| 3 | **S3 storage driver untested** against a real bucket. | Screenshots would fail to save if an S3 setting is wrong (the API returns 500 and creates no ticket). | Test once with the real bucket right after deploying; `scripts/demo-flow.mjs` does not cover uploads, use the widget. |
| 4 | **Email notifications are not implemented** (optional in the proposal). | Testers must open the dashboard to see replies. | Future work. |
| 5 | **No automated browser tests.** | Widget and dashboard UI are verified only by the manual run in [TEST_REPORT.md](TEST_REPORT.md). | Add Playwright later. |
| 6 | Only Chromium was used for manual checks. | Firefox and Safari behaviour of html2canvas and the widget UI is unknown. | Test in the supervisor's browser beforehand. |
| 7 | No separate "duplicate" button in the dashboard. | Duplicate marking works through the API only. | Use Swagger, or add a small selector. |
| 8 | Accessibility not audited with a screen reader. | Labels, roles, focus rings and keyboard-friendly modals exist but are untested. | Audit before a real launch. |
| 9 | `docker-compose.yml` is untested. | Setup via Docker may need small tweaks. | Use a native PostgreSQL, as in the README, if it fails. |

## By design

- **html2canvas is not a real screen capture.** It redraws the page from the DOM, so some CSS (filters, blend modes, newer colour functions), cross-origin images without CORS headers, iframes, video and WebGL canvases can be blank or different. The proposal accepts this. Only the visible viewport is captured.
- **The widget needs a tester account.** The reporter is a required field in the proposal's data model, so a tester signs in inside the widget with an account that is a member of the project. Anonymous reports are not possible.
- **Widget key is public.** It sits in the page source. The protection is the origin list, rate limit, size limits and the sign-in. A non-browser client can send any `Origin` header, so a leaked key plus a stolen tester login would allow reports (never reads).
- **Access tokens are kept in `localStorage`** in the dashboard (simple and works across the Vercel and Render domains). A cross-site scripting bug would expose them. React escapes all text and the API stores captured text as plain data, but this is a trade-off compared with HttpOnly cookies.
- **Blur uses large-block pixelation.** It cannot be reversed (many pixels become one average colour), but a very large pixelation of a very short text can still hint at its length or colour. Use a bigger blur box for secrets.
- **The webhook secret is stored in clear text** in PostgreSQL because HMAC needs the original value. It is never returned by the API after saving. Encrypt the column if the database is shared.
- **Client sees only builds that left Draft.** "Shared with them" is implemented as "any client of the project can see non-draft builds", not per-person sharing.
- **A build with a High or Blocker ticket blocks approval until the ticket is Verified**, not only until it is Resolved. This forces the tester step. Medium and Low tickets never block.
- **Rate limits are per server instance and kept in memory.** They reset on restart and are not shared across several instances.
- **Delete is permanent.** There is no recycle bin for tickets or projects.
- **Retention is a script**, not an automatic scheduler. Run `pnpm --filter @inspectflow/api retention` from cron or a scheduled job.

## Free hosting risks (see the deployment guide for sources)

- **Cold starts.** Render's free web service sleeps after 15 minutes without traffic and takes up to a minute to wake. The first request after a pause is slow or can time out. Open the API `/health` URL a few minutes before the demo.
- **Database pause.** A free Supabase project is paused after a week of inactivity. A daily GitHub Actions ping is provided in `.github/workflows/keepalive.yml` (requires the `API_URL` repository variable).
- **Webhook delivery while asleep.** GitHub may time out while Render wakes up. GitHub shows the failed delivery and lets you redeliver it; the replay protection makes redelivery safe.
- **Free-tier limits change.** The numbers in the deployment guide were checked on 14 November 2026 from search results and vendor pages; re-check before relying on them.
- **Local file storage is ephemeral** on Render. Always use `STORAGE_DRIVER=s3` in production.
