// End-to-end demo workflow against a running InspectFlow API (local or deployed).
//
//   node scripts/demo-flow.mjs                       # uses http://localhost:5001
//   API_URL=https://your-api.onrender.com node scripts/demo-flow.mjs
//
// It plays the Project Lead, Developer, Tester and Client from the seed data:
//   1. Lead connects the GitHub repository (webhook secret).
//   2. Developer links a branch to every blocking ticket.
//   3. A SIGNED pull_request webhook is delivered (opened, then merged).
//      NOTE: the payloads are built here and signed with the project secret. They
//      are real HMAC-signed requests, but they do not come from github.com.
//      A real GitHub merge needs your own repository (see docs/DEPLOYMENT.md).
//   4. A replayed delivery and a bad signature are sent to show both are rejected.
//   5. Tester verifies the resolved tickets.
//   6. Client reviews the build and approves it; the approval is read back.
//
// Run it once per fresh seed (pnpm --filter @inspectflow/api seed).
import { createHmac } from "node:crypto";

const API = (process.env.API_URL ?? "http://localhost:5001").replace(/\/+$/, "");
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@12345";
const REPO = process.env.DEMO_GITHUB_REPO ?? "demo-org/acme-shop";
const SECRET = process.env.DEMO_WEBHOOK_SECRET ?? "demo-webhook-secret-change-me";

const steps = [];
const ok = (msg) => { steps.push(["PASS", msg]); console.log(`  PASS  ${msg}`); };
const fail = (msg) => { steps.push(["FAIL", msg]); console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email) {
  const r = await call(null, "POST", "/auth/login", { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`Cannot log in as ${email} (${r.status}). Did you run the seed?`);
  return r.data.accessToken;
}

let delivery = Date.now();
async function webhook(payload, { secret = SECRET, id = `demo-${++delivery}` } = {}) {
  const raw = JSON.stringify(payload);
  const sig = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const res = await fetch(`${API}/webhooks/github`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GitHub-Event": "pull_request", "X-GitHub-Delivery": id, "X-Hub-Signature-256": sig },
    body: raw,
  });
  return { status: res.status, data: await res.json().catch(() => null), id };
}

const pr = (action, number, branch, merged = false) => ({
  action,
  number,
  repository: { full_name: REPO },
  pull_request: { number, merged, head: { ref: branch }, merge_commit_sha: "c0ffee1234567", merged_by: { login: "demo-dev" } },
});

console.log(`InspectFlow demo workflow against ${API}\n`);
const lead = await login("lead@inspectflow.demo");
const dev = await login("dev@inspectflow.demo");
const tester = await login("tester@inspectflow.demo");
const client = await login("client@inspectflow.demo");

const projects = (await call(lead, "GET", "/projects")).data;
const project = projects.find((p) => p.name.startsWith("Acme Shop"));
if (!project) throw new Error("Demo project not found. Run the seed first.");
const P = `/projects/${project.id}`;

console.log("1. Project Lead connects GitHub");
const gh = await call(lead, "PATCH", `${P}/github`, { githubRepo: REPO, webhookSecret: SECRET });
check(gh.status === 200, `repository ${REPO} connected`);

console.log("2. Client opens the build under review");
const builds = (await call(client, "GET", `${P}/builds`)).data;
const build = builds.find((b) => b.status === "IN_REVIEW");
if (!build) throw new Error("No build in review. Run the seed first.");
let review = (await call(client, "GET", `/builds/${build.id}/review`)).data;
check(review.canApprove === false, `approval is blocked by ${review.blockingTickets.length} blocking ticket(s)`);
const early = await call(client, "POST", `/builds/${build.id}/decision`, { decision: "APPROVED" });
check(early.status === 409, `approving too early is refused (409: ${early.data?.message})`);

console.log("3. Developer links branches; signed webhooks resolve the tickets");
let n = 200;
for (const t of review.blockingTickets) {
  const branch = `fix/ticket-${t.number}`;
  const prNumber = ++n;
  const link = await call(dev, "POST", `/tickets/${t.id}/link`, { branch });
  check(link.status === 201, `IF-${t.number} linked to branch ${branch}`);

  const opened = await webhook(pr("opened", prNumber, branch));
  check(opened.status === 200, `PR #${prNumber} opened: ${opened.data?.outcome}`);

  const merged = await webhook(pr("closed", prNumber, branch, true));
  check(merged.status === 200 && /resolved 1/.test(merged.data?.outcome ?? ""), `PR #${prNumber} merged: ${merged.data?.outcome}`);

  const replay = await webhook(pr("closed", prNumber, branch, true), { id: merged.id });
  check(replay.status === 200 && replay.data?.duplicate === true, "replayed delivery ignored (duplicate)");

  const detail = (await call(dev, "GET", `/tickets/${t.id}`)).data;
  check(detail.status === "RESOLVED" || detail.status === "VERIFIED", `IF-${t.number} is now ${detail.status}`);
}

console.log("4. Invalid signature is rejected");
const bad = await webhook(pr("closed", 999, "x", true), { secret: "not-the-real-secret-at-all" });
check(bad.status === 401, `bad signature rejected with ${bad.status}`);

console.log("5. Tester verifies the fixes");
review = (await call(client, "GET", `/builds/${build.id}/review`)).data;
check(review.canApprove === false, "resolved but unverified tickets still block approval");
for (const t of review.blockingTickets) {
  const v = await call(tester, "POST", `/tickets/${t.id}/status`, { status: "VERIFIED", note: "Fix confirmed on staging." });
  check(v.status === 201, `IF-${t.number} verified by tester`);
}

console.log("6. Client approves the build");
const dev403 = await call(dev, "POST", `/builds/${build.id}/decision`, { decision: "APPROVED" });
check(dev403.status === 403, "a developer cannot approve (403)");
const approve = await call(client, "POST", `/builds/${build.id}/decision`, { decision: "APPROVED", note: "All blocking issues verified. Approved." });
check(approve.status === 201, "client approval accepted");
check(approve.data?.approval?.commitSha === build.commitSha, `approval recorded against commit ${build.commitSha.slice(0, 10)}`);
const history = (await call(lead, "GET", `${P}/approvals`)).data;
check(history.some((a) => a.decision === "APPROVED" && a.build.id === build.id), "approval visible in the Lead's approval history");

const failed = steps.filter(([s]) => s === "FAIL").length;
console.log(`\n${steps.length - failed}/${steps.length} checks passed${failed ? `, ${failed} FAILED` : ""}.`);
process.exit(failed ? 1 : 0);
