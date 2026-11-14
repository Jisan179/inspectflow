# Deployment guide (free tier)

**Current state: deployed (14 November 2026).** Dashboard: https://inspectflow-web-seven.vercel.app, API: https://inspectflow-api.onrender.com (health at `/health`), staging demo: https://inspectflow-staging.vercel.app. Demo data is loaded and a read-only production smoke test passed 21/21 (see [TEST_REPORT.md](TEST_REPORT.md)). The sections below are kept as the original walkthrough for redeploying from scratch.

**Reset the demo data:** in the Render dashboard set the env var `RUN_SEED=true` and save (the next boot runs the seed inside Render, where the secrets live), then set it back to `false`. Leaving it `true` would wipe reported tickets on every restart. The daily keep-alive ping is enabled (repository variable `API_URL` is set).

## 1. Decision: which hosting option

Both options from the brief were evaluated against vendor pages and current articles (searched 14 November 2026; figures can change, re-check before relying on them).

| Service | Free-tier facts found | Consequence for InspectFlow |
| --- | --- | --- |
| **Vercel Hobby** (dashboard, demo staging site) | Free for personal, non-commercial use | Fine for this academic demo. Static and serverless only, which suits both sites. |
| **Render free web service** (API) | Spins down after 15 minutes without traffic and takes up to about a minute to wake; 750 free instance hours per month per workspace; filesystem is ephemeral; free Postgres **expires after 30 days** ([Render docs](https://render.com/docs/free)) | Use Render only for the API. Never for the database. Never `STORAGE_DRIVER=local`. Expect a slow first request. |
| **Supabase Free** (Postgres + Storage) | 500 MB database, 1 GB file storage with a 50 MB upload limit, 2 active projects, **paused after 1 week of inactivity** ([Supabase pricing](https://supabase.com/pricing), [summary](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)) | Plenty for a demo. The weekly pause is the main risk; the keep-alive workflow prevents it. |
| **Neon Free** (Postgres) | 1 GB storage per project in the current FAQ (older pages say 0.5 GB), compute suspends after 5 minutes and wakes on demand ([Neon FAQ](https://neon.com/faqs/free-plan-limits-and-quotas)) | Works, with an extra short wake delay on the first query. |
| **Cloudflare R2** (storage) | 10 GB storage, 1 million writes and 10 million reads per month, free egress ([summary](https://freetier.co/alternatives/cloudflare-r2)). One source says no card is needed; I could not confirm this on Cloudflare's own page. | Good if it does not ask for a payment method on your account. |

**Chosen: Option A.** Vercel (dashboard and staging site) + Render (API) + **Supabase** for both PostgreSQL and private S3-compatible storage. One account covers database and files, no card is expected, and the project stays on PostgreSQL + Prisma. **Option B** (Neon + R2) is a drop-in alternative: only `DATABASE_URL` and the `S3_*` variables change.

Not verified by me (check in your dashboards): Supabase's S3-compatible endpoint wording and the exact connection-string format; neither could be confirmed from the search results.

## 2. What you need (YOU)

1. A GitHub account and a repository containing this project (create it, then push; see section 3). Pushing is your decision, nothing has been pushed.
2. A Supabase account (sign in with GitHub).
3. A Render account (sign in with GitHub).
4. A Vercel account (sign in with GitHub).

Do not paste passwords or keys into chat. Enter them only in the vendors' dashboards.

## 3. Put the code on GitHub (YOU)

```bash
cd "E:/Personal Project/inspectflow"
git add -A
git commit -m "InspectFlow"
git branch -M main
git remote add origin https://github.com/<you>/inspectflow.git
git push -u origin main
```

`.env` files, `.pgdata`, `node_modules` and `uploads` are ignored by `.gitignore`. Check `git status` shows no `.env` before pushing.

## 4. Supabase: database and storage (YOU)

1. New project, choose a region near Render's *Singapore* region, set a database password (keep it in a password manager).
2. **Database URL.** Project Settings, Database, Connection string. Use the **Session pooler** string (port 5432). Render's free instances do not use IPv6, so the direct connection string may not work. Append `?connection_limit=5` if Prisma warns about connections. This is `DATABASE_URL`.
3. **Storage.** Storage, New bucket `inspectflow-screenshots`, keep **Private** (do not tick public). Then Storage settings, S3 connection: copy the endpoint (looks like `https://<project-ref>.storage.supabase.co/storage/v1/s3`) and the region, and create an access key pair. These become `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Keep `S3_FORCE_PATH_STYLE=true`.

(Option B instead: Neon connection string for `DATABASE_URL`; Cloudflare R2 bucket, endpoint `https://<account-id>.r2.cloudflarestorage.com`, region `auto`, and an R2 API token with object read and write.)

## 5. Render: the API (YOU)

1. New, Blueprint, pick your repository. Render reads [render.yaml](../render.yaml).
2. Fill the prompted values: `DATABASE_URL`, `S3_*`, and for now `PUBLIC_API_URL`, `FRONTEND_URL` and `CORS_ORIGINS` with placeholder `https://example.com` (you fix them in step 7).
3. Wait for the first deploy. The start command runs `prisma migrate deploy` (creates all tables) and then the API.
4. Note the service URL, for example `https://inspectflow-api.onrender.com`. Set `PUBLIC_API_URL` to it (this is used in signed file links and the webhook URL).
5. Open `<url>/health`. Expected: `{"status":"ok","database":"up",...}`. The first call can take up to a minute.

Build and start commands, for reference: build `npm install -g pnpm@12.16.1 && pnpm install --frozen-lockfile && pnpm --filter @inspectflow/api build`; start `cd apps/api && npx prisma migrate deploy && node dist/main`; health check `/health`.

## 6. Vercel: dashboard and demo staging site (YOU)

**Dashboard.** Add New Project, import the repository, **Root Directory `apps/web`**, framework Next.js. Environment variables: `NEXT_PUBLIC_API_URL` = the Render URL, `NEXT_PUBLIC_WEB_URL` = the project's own Vercel URL (you can set it after the first deploy and redeploy). The build script builds the widget first and publishes it at `/inspectflow-widget.js`.

**Staging site.** Another project, same repository, **Root Directory `apps/staging`**, framework *Other*. Environment variables: `WIDGET_KEY=if_pk_demo_acme_staging_key_0001` (the seed's fixed demo key; it is a public identifier), `API_URL` = the Render URL. [vercel.json](../apps/staging/vercel.json) sets the build command `pnpm run build` (it builds the widget first, which is not stored in Git, then the site) and the output folder `dist`; `api/orders.js` becomes the deliberately failing endpoint.

## 7. Connect everything

1. In Render set `FRONTEND_URL` and `CORS_ORIGINS` to the dashboard's Vercel URL (exactly, no trailing slash) and redeploy.
2. **Create the demo data in the cloud database** (from your computer; this writes to the cloud DB, so check the URL twice):

   ```powershell
   cd "E:\Personal Project\inspectflow\apps\api"
   $env:DATABASE_URL = "<Supabase session pooler URL>"
   $env:STORAGE_DRIVER = "s3"; $env:S3_ENDPOINT = "..."; $env:S3_REGION = "..."
   $env:S3_ACCESS_KEY_ID = "..."; $env:S3_SECRET_ACCESS_KEY = "..."
   $env:DEMO_STAGING_ORIGINS = "https://<your-staging>.vercel.app"
   $env:DEMO_GITHUB_REPO = "<you>/<test-repo>"       # optional
   $env:DEMO_WEBHOOK_SECRET = "<long random string>"  # optional, needed with the repo
   pnpm seed
   ```
3. Check that the login page's demo box works. The quick-fill button uses the default demo password; if you set `DEMO_PASSWORD`, set `NEXT_PUBLIC_SHOW_DEMO=false` in Vercel and give the supervisor the credentials privately instead.

Security note for a public demo: the demo accounts and widget key are fictional but public. Do not store real information in a database that has them, and delete the demo users (or change their passwords) after the defense.

## 8. Production smoke test

Run from your computer against the deployed API; this plays the whole workflow with the four demo roles:

```bash
API_URL=https://<your-api>.onrender.com node scripts/demo-flow.mjs
```

It needs a freshly seeded database. If `DEMO_GITHUB_REPO`/`DEMO_WEBHOOK_SECRET` were used for the seed, pass the same values as environment variables. Then verify by hand:

- [ ] `<api>/health` shows the database as up.
- [ ] `<api>/api/docs` loads.
- [ ] Dashboard login works for all four demo users.
- [ ] Open the staging site, click *Report issue*, sign in as the tester, draw, blur, send. A new ticket appears for the developer and the screenshot loads (this proves the S3 driver).
- [ ] Image link from another browser after 6 minutes no longer works (signed URL expired).

Record the three URLs and the results in your report. Only then claim "deployed".

## 9. Connect GitHub for a real merge (YOU)

1. Create a test repository (private is fine). In the dashboard (Lead): project Settings, GitHub connection, enter `owner/repo`, leave the secret empty to generate one, copy the shown **Payload URL** and **Secret** (shown once).
2. GitHub, repository Settings, Webhooks, Add webhook: Payload URL `<api>/webhooks/github`, Content type `application/json`, the secret, event **Pull requests** only.
3. GitHub sends a *ping*; the delivery appears in the dashboard's delivery list as `pong`.
4. In a ticket, link branch `fix/demo-button`. Push that branch, open a pull request (the number is attached to the ticket), merge it. The ticket should move to **Resolved** with an automatic activity entry, and a new delivery with outcome *resolved 1 ticket(s)* appears.
5. If the API was asleep, GitHub may show a timeout. Open the delivery in GitHub and click **Redeliver**; replay protection makes this safe.

## 10. Operating notes

- **Before the demo:** open `/health` five minutes earlier so Render and Supabase are awake. Enable the keep-alive workflow by adding the repository variable `API_URL` (Settings, Secrets and variables, Actions, Variables).
- **Migrations** run automatically on every Render start. For a manual run: `pnpm --filter @inspectflow/api migration:run` with `DATABASE_URL` set.
- **Rotating secrets:** change `JWT_*` secrets in Render to sign everyone out.
- **Retention:** schedule `pnpm --filter @inspectflow/api retention` (set `SCREENSHOT_RETENTION_DAYS`) if screenshots should expire.
- **Costs:** none expected. If any vendor asks for a card, stop and choose the other option rather than enabling paid usage.

## 11. Environment variables per service

| Service | Variable | Value |
| --- | --- | --- |
| Render | `DATABASE_URL` | Supabase session pooler or Neon string |
| Render | `PUBLIC_API_URL` | the Render URL |
| Render | `FRONTEND_URL`, `CORS_ORIGINS` | the dashboard Vercel URL |
| Render | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` | generated by the blueprint |
| Render | `STORAGE_DRIVER`, `S3_*` | `s3` and your bucket values |
| Vercel (web) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL` | the Render URL, the dashboard URL |
| Vercel (staging) | `WIDGET_KEY`, `API_URL` | demo key, the Render URL |
| GitHub Actions | `API_URL` (variable) | the Render URL, optional keep-alive |
