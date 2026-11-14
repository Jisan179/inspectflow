# Proposal versus Marker.io

Marker.io is a commercial visual-feedback product. It was read as **inspiration only**: no code, logo, wording, image or layout was copied, and nothing from Marker.io is a dependency. Facts below come from reading marker.io, its features page and its help centre on 14 November 2026 (summarised in my own words). Colours and typography could not be verified from the text I could fetch.

## Feature comparison

| Topic | Marker.io (as advertised) | InspectFlow (this project) |
| --- | --- | --- |
| Feedback widget on a live site | Yes; reporters need no account | Yes; the tester signs in to the widget (reporter is a required field in the data model) |
| Install | Script snippet, npm package, browser extension, CMS plugins | Script tag only. A Chrome extension is listed as future work in the proposal |
| Screenshot annotation | Yes | Yes: arrow, box, **irreversible blur**, undo, redo |
| Technical context (console, network, browser, screen size, URL) | Yes, automatic | Yes, automatic, bounded rolling buffer, secrets removed in the browser and again on the server |
| Session replay | Yes | **No** (future work: rrweb) |
| Privacy controls | Data masking; GDPR and SOC 2 claims | Blur applied before upload, header and body never captured, private storage, expiring links, retention script. No compliance certification |
| Issue tracker | Syncs two-way with Jira, GitHub, GitLab, Linear and others | **Native** projects, tickets, roles and comments; no Jira or Slack sync (out of scope) |
| Git integration | Through the tracker integrations | Branch and PR linking and **auto-resolve on merge** through a signed webhook |
| Client sign-off on a build | Not part of the advertised feature list I read | **Formal build approval** with note, timestamp and exact commit SHA; blocked while High or Blocker tickets are unverified |
| AI features (titles, rewrites, translation, scanner) | Yes | No (out of scope) |
| Hosting and price | SaaS, paid per plan, free trial | Free and self-hostable; runs on free tiers |
| Target users | Agencies and product teams | Small agencies, freelancers and student teams with budget limits |

## Design inspiration taken (original implementation)

- A **floating "report" button** with a short, guided panel rather than a long form.
- A **full-screen annotation view** beside a small form, with the tools in a toolbar.
- Technical details shown as readable lists and a failed-request table, not raw JSON.
- A public marketing page with a navigation bar, hero with two calls to action, feature blocks and a closing call to action, then a separate application area behind sign-in.
- Role-aware dashboards that show a client a simpler view than a developer.

All visual design (logo, colours, layout, copy, icons) is original to InspectFlow.

## Deliberately not copied or added

Session replay, AI features, third-party integrations, billing, video recording, native mobile apps and other roles are outside the approved scope of the proposal.
