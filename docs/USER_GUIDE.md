# InspectFlow user guide

A short guide for the three roles. No code knowledge needed.

## Sign in

Open the dashboard and use **Sign in**. New users choose **Get started** and create an account, then ask a Project Lead to add them to a project (the Lead needs the email you registered with).

## Tester or client

1. **Open the staging website** of your project (the link is on your project's *Overview* tab).
2. Click **Report issue** (bottom corner of the page). Sign in with your InspectFlow account the first time.
3. The page is captured. On the annotation screen:
   - **Arrow** and **Box** point at the problem.
   - **Blur** hides private information (names, emails, codes). Blurred areas are destroyed in the image before it is sent.
   - **Undo** and **Redo** step through your drawing.
4. Describe the problem, choose how serious it is, read *What will be sent with this report*, and press **Send report**. You get a ticket number such as IF-12.
5. In the dashboard open **My reports** to see status and replies, add comments, and when a ticket is **Resolved** press **Verify fix** (it works) or **Reopen** (it does not).
6. Open **Build review** for builds shared with you. Check the blocking tickets, then **Approve build** or **Request changes** (a note is required). A build cannot be approved while a High or Blocker ticket is not verified.

What the widget sends: a screenshot, the page address, browser and screen size, recent console errors, and failed network requests (address, method, status). It never sends passwords, cookies, tokens or the contents of requests.

## Developer

- **Tickets** shows every ticket. Search by title, description or number (`IF-12`), filter by status, severity, assignee and build, and sort by clicking column titles. The address bar keeps your filters, so you can bookmark a view.
- Open a ticket to see the annotated screenshot, environment, **console errors and exceptions**, and the **failed requests** table. Add a comment, assign someone, change the severity.
- **Start work** and **Mark resolved** change the status. Enter the **branch** (and later the PR number) under *Triage*. When the pull request is merged on GitHub the ticket becomes Resolved automatically.
- **Builds**: *Register build* with name, branch, commit SHA and preview URL. It starts as **Draft** (invisible to clients). **Mark ready for review** shares it with the clients.
- Developers cannot verify their own fixes; the tester does.

## Project Lead

Everything a developer can do, plus:

- **Members**: add a registered user by email with a role, change a role, remove a member.
- **Settings**:
  - *Widget*: shows the key prefix and the embed code. Press **Rotate key** for a new key (shown once; the old key stops working). List the websites allowed to send reports under *Allowed origins*.
  - *GitHub connection*: repository as `owner/repo`; the webhook URL and secret to put into GitHub; the list of recent deliveries with their outcome.
  - *Danger zone*: delete the project and all its data.
- **Overview**: counts, approval history and the recent activity log.
- Delete a ticket from its page.

## Adding the widget to a website

Paste before `</body>`:

```html
<script src="https://YOUR-DASHBOARD/inspectflow-widget.js"
        data-key="YOUR_WIDGET_KEY"
        data-api="https://YOUR-API"
        defer></script>
```

and add the website's address (for example `https://staging.example.com`) to *Allowed origins*.

## Roles at a glance

| | Tester / Client | Developer | Project Lead |
| --- | --- | --- | --- |
| Report issues with the widget | yes | yes | yes |
| See tickets | own reports | all | all |
| See technical evidence | no | yes | yes |
| Start work, resolve | no | yes | yes |
| Verify or reopen a fix | yes | no | yes |
| Register builds, mark ready | no | yes | yes |
| Approve or reject a build | yes | no | no |
| Members, settings, GitHub, delete | no | no | yes |
