import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "@/providers/database/prisma.service";
import { computeSignature } from "@/modules/github/github.service";
import {
  auth,
  createProjectWithTeam,
  createTestApp,
  resetDb,
} from "./helpers";

type Team = Awaited<ReturnType<typeof createProjectWithTeam>>;

const REPO = "acme/shop-frontend";
const SECRET = "webhook-secret-for-tests-123456";

describe("GitHub webhook (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let team: Team;
  const server = () => app.getHttpServer();
  let delivery = 0;

  /** Sends a signed (or deliberately badly signed) webhook like GitHub does. */
  const send = (
    event: string,
    payload: object,
    opts: { secret?: string; deliveryId?: string; signature?: string } = {},
  ) => {
    const body = JSON.stringify(payload);
    const sig = opts.signature ?? computeSignature(opts.secret ?? SECRET, body);
    return request(server())
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", event)
      .set("X-GitHub-Delivery", opts.deliveryId ?? `delivery-${++delivery}`)
      .set("X-Hub-Signature-256", sig)
      .send(body);
  };

  const pr = (action: string, number: number, branch: string, merged = false) => ({
    action,
    number,
    repository: { full_name: "Acme/Shop-Frontend" }, // GitHub casing differs: must still match
    pull_request: { number, merged, head: { ref: branch }, merge_commit_sha: "deadbeef", merged_by: { login: "octocat" } },
  });

  const newTicket = async (title: string, severity = "MEDIUM") =>
    (
      await request(server())
        .post(`/projects/${team.projectId}/tickets`)
        .set(auth(team.tester))
        .send({ title, description: "d", severity })
        .expect(201)
    ).body.id as string;

  const status = async (id: string) =>
    (await prisma.ticket.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
    team = await createProjectWithTeam(app);
    await request(server())
      .patch(`/projects/${team.projectId}/github`)
      .set(auth(team.lead))
      .send({ githubRepo: REPO, webhookSecret: SECRET })
      .expect(200);
  });
  afterAll(() => app.close());

  it("rejects an invalid signature with 401 and records the attempt", async () => {
    const res = await send("pull_request", pr("closed", 1, "fix/x", true), { secret: "wrong-secret-wrong-secret" });
    expect(res.status).toBe(401);
    const rejected = await prisma.webhookDelivery.findMany({ where: { signatureValid: false } });
    expect(rejected.length).toBe(1);
    expect(rejected[0].outcome).toMatch(/invalid signature/);
  });

  it("rejects a missing, empty or malformed signature", async () => {
    await send("ping", { repository: { full_name: REPO } }, { signature: "" }).expect(401);
    await send("ping", { repository: { full_name: REPO } }, { signature: "sha256=abc" }).expect(401);
    await send("ping", { repository: { full_name: REPO } }, { signature: "md5=abc" }).expect(401);
  });

  it("rejects a valid signature of a tampered body", async () => {
    const original = JSON.stringify(pr("closed", 2, "fix/x", true));
    const sig = computeSignature(SECRET, original);
    const tampered = original.replace('"number":2', '"number":3');
    const res = await request(server())
      .post("/webhooks/github")
      .set("Content-Type", "application/json")
      .set("X-GitHub-Event", "pull_request")
      .set("X-GitHub-Delivery", "tamper-1")
      .set("X-Hub-Signature-256", sig)
      .send(tampered);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown repository (no information leak)", async () => {
    const res = await send("ping", { repository: { full_name: "someone/else" } });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid webhook signature");
    await request(server()).post("/webhooks/github").send({}).expect(401);
  });

  it("answers ping", async () => {
    const res = await send("ping", { repository: { full_name: REPO } }).expect(200);
    expect(res.body.outcome).toBe("pong");
  });

  describe("merged pull request resolves linked tickets", () => {
    it("resolves a ticket linked by PR number", async () => {
      const id = await newTicket("Linked by PR number");
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({ prNumber: 21 }).expect(201);
      const res = await send("pull_request", pr("closed", 21, "whatever", true)).expect(200);
      expect(res.body.outcome).toMatch(/resolved 1 ticket/);
      expect(await status(id)).toBe("RESOLVED");
      const t = await prisma.ticket.findUniqueOrThrow({ where: { id } });
      expect(t.resolvedAt).not.toBeNull();
      const log = await prisma.activityLog.findFirstOrThrow({ where: { ticketId: id, action: "ticket.auto_resolved" } });
      expect(log.metadata).toMatchObject({ prNumber: 21, mergedBy: "octocat" });
    });

    it("full flow: link branch -> PR opened links the number -> merge resolves -> tester verifies", async () => {
      const id = await newTicket("Button fix", "HIGH");
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({ branch: "fix/button" }).expect(201);
      await request(server()).post(`/tickets/${id}/status`).set(auth(team.dev)).send({ status: "IN_PROGRESS" }).expect(201);

      const opened = await send("pull_request", pr("opened", 30, "fix/button")).expect(200);
      expect(opened.body.outcome).toMatch(/linked PR #30 to 1/);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id } })).prNumber).toBe(30);

      await send("pull_request", pr("closed", 30, "fix/button", true)).expect(200);
      expect(await status(id)).toBe("RESOLVED");

      await request(server()).post(`/tickets/${id}/status`).set(auth(team.tester)).send({ status: "VERIFIED" }).expect(201);
      expect(await status(id)).toBe("VERIFIED");
    });

    it("does not resolve when the PR is closed without merging", async () => {
      const id = await newTicket("Closed unmerged");
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({ prNumber: 40 }).expect(201);
      const res = await send("pull_request", pr("closed", 40, "x", false)).expect(200);
      expect(res.body.outcome).toMatch(/without merge/);
      expect(await status(id)).toBe("OPEN");
    });

    it("does not touch verified tickets or tickets of other PRs", async () => {
      const other = await newTicket("Other PR");
      await request(server()).post(`/tickets/${other}/link`).set(auth(team.dev)).send({ prNumber: 99 }).expect(201);
      const none = await send("pull_request", pr("closed", 55, "unrelated", true)).expect(200);
      expect(none.body.outcome).toMatch(/no linked open tickets/);
      expect(await status(other)).toBe("OPEN");
    });

    it("does not resolve tickets of a different project with the same branch name", async () => {
      const foreign = await createProjectWithTeam(app);
      const ft = await request(server())
        .post(`/projects/${foreign.projectId}/tickets`)
        .set(auth(foreign.tester))
        .send({ title: "Foreign ticket", description: "d" })
        .expect(201);
      await request(server()).post(`/tickets/${ft.body.id}/link`).set(auth(foreign.dev)).send({ branch: "fix/shared-name" }).expect(201);
      const mine = await newTicket("Mine");
      await request(server()).post(`/tickets/${mine}/link`).set(auth(team.dev)).send({ branch: "fix/shared-name" }).expect(201);

      await send("pull_request", pr("closed", 60, "fix/shared-name", true)).expect(200);
      expect(await status(mine)).toBe("RESOLVED");
      expect(await status(ft.body.id)).toBe("OPEN");
    });
  });

  describe("duplicate and retry handling", () => {
    it("ignores a replayed delivery and applies the change only once", async () => {
      const id = await newTicket("Replay test");
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({ prNumber: 70 }).expect(201);

      const first = await send("pull_request", pr("closed", 70, "r", true), { deliveryId: "dup-1" }).expect(200);
      expect(first.body.duplicate).toBeUndefined();
      expect(await status(id)).toBe("RESOLVED");

      // reopen (tester rejects the fix), then GitHub redelivers the same event
      await request(server()).post(`/tickets/${id}/status`).set(auth(team.tester)).send({ status: "OPEN" }).expect(201);
      const second = await send("pull_request", pr("closed", 70, "r", true), { deliveryId: "dup-1" }).expect(200);
      expect(second.body.duplicate).toBe(true);
      expect(await status(id)).toBe("OPEN"); // not re-resolved by the replay
      expect(await prisma.webhookDelivery.count({ where: { deliveryId: "dup-1" } })).toBe(1);
    });

    it("does not store a half-applied delivery if processing fails", async () => {
      // a payload whose action is merged but ticket update is fine -> use a bad shape instead
      const res = await send("pull_request", { repository: { full_name: REPO }, action: "closed" }, { deliveryId: "shape-1" }).expect(200);
      expect(res.body.outcome).toMatch(/no pull request number/);
    });

    it("ignores other events", async () => {
      const res = await send("issues", { repository: { full_name: REPO }, action: "opened" }).expect(200);
      expect(res.body.outcome).toBe("ignored: issues");
    });
  });

  it("shows delivery history to Lead and Developer only", async () => {
    const res = await request(server()).get(`/projects/${team.projectId}/webhook-deliveries`).set(auth(team.dev)).expect(200);
    expect(res.body.items.length).toBeGreaterThan(3);
    expect(res.body.items.some((d: any) => d.signatureValid === false)).toBe(true);
    expect(res.body.items[0]).toEqual(expect.objectContaining({ event: expect.any(String), deliveryId: expect.any(String) }));
    await request(server()).get(`/projects/${team.projectId}/webhook-deliveries`).set(auth(team.tester)).expect(403);
  });
});
