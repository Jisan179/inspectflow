import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "@/providers/database/prisma.service";
import {
  auth,
  createProjectWithTeam,
  createTestApp,
  registerUser,
  resetDb,
} from "./helpers";

type Team = Awaited<ReturnType<typeof createProjectWithTeam>>;

describe("Tickets: lifecycle, permissions, search (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let team: Team;
  const server = () => app.getHttpServer();

  const createTicket = (user: any, body: Record<string, unknown> = {}) =>
    request(server())
      .post(`/projects/${team.projectId}/tickets`)
      .set(auth(user))
      .send({ title: "Checkout button broken", description: "Nothing happens", severity: "MEDIUM", ...body });

  const setStatus = (user: any, id: string, status: string, note?: string) =>
    request(server()).post(`/tickets/${id}/status`).set(auth(user)).send({ status, note });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
    team = await createProjectWithTeam(app);
  });
  afterAll(() => app.close());

  it("creates tickets with sequential per-project numbers", async () => {
    const a = await createTicket(team.tester).expect(201);
    const b = await createTicket(team.tester).expect(201);
    expect([a.body.number, b.body.number]).toEqual([1, 2]);
    expect(a.body.status).toBe("OPEN");
    expect(a.body.reporterId).toBe(team.tester.id);
  });

  it("validates ticket input", async () => {
    await createTicket(team.tester, { title: "x" }).expect(400);
    await createTicket(team.tester, { severity: "EXTREME" }).expect(400);
    await createTicket(team.tester, { buildId: "11111111-1111-4111-8111-111111111111" }).expect(400);
  });

  describe("full lifecycle: Open -> In Progress -> Resolved -> Verified", () => {
    let id: string;
    beforeAll(async () => {
      id = (await createTicket(team.tester, { title: "Lifecycle ticket" })).body.id;
    });

    it("tester cannot start or resolve work", async () => {
      await setStatus(team.tester, id, "IN_PROGRESS").expect(403);
      await setStatus(team.tester, id, "RESOLVED").expect(403);
    });

    it("developer moves Open -> In Progress -> Resolved", async () => {
      await setStatus(team.dev, id, "IN_PROGRESS").expect(201);
      const res = await setStatus(team.dev, id, "RESOLVED", "Fixed in PR").expect(201);
      expect(res.body.resolvedAt).toBeTruthy();
    });

    it("developer cannot verify; no skipping steps; no no-op moves", async () => {
      await setStatus(team.dev, id, "VERIFIED").expect(403);
      await setStatus(team.dev, id, "RESOLVED").expect(400);
      const fresh = (await createTicket(team.tester)).body.id;
      await setStatus(team.lead, fresh, "VERIFIED").expect(403);
    });

    it("tester verifies the fix", async () => {
      await setStatus(team.tester, id, "VERIFIED").expect(201);
    });

    it("tester can reopen a verified ticket and resolvedAt is cleared", async () => {
      const res = await setStatus(team.tester, id, "OPEN").expect(201);
      expect(res.body.resolvedAt).toBeNull();
    });

    it("records every change in the activity history", async () => {
      const detail = await request(server()).get(`/tickets/${id}`).set(auth(team.dev)).expect(200);
      const actions = detail.body.activities.map((a: any) => a.action);
      expect(actions).toEqual(expect.arrayContaining(["ticket.created", "ticket.status_changed"]));
      const changes = detail.body.activities
        .filter((a: any) => a.action === "ticket.status_changed")
        .map((a: any) => `${a.metadata.from}>${a.metadata.to}`);
      expect(changes).toEqual([
        "OPEN>IN_PROGRESS",
        "IN_PROGRESS>RESOLVED",
        "RESOLVED>VERIFIED",
        "VERIFIED>OPEN",
      ]);
      // the developer's note became a comment
      expect(detail.body.comments.some((c: any) => c.body === "Fixed in PR")).toBe(true);
    });
  });

  describe("visibility", () => {
    let own: string;
    let other: Awaited<ReturnType<typeof registerUser>>;

    beforeAll(async () => {
      other = await registerUser(app, "Second Tester");
      await request(server())
        .post(`/projects/${team.projectId}/members`)
        .set(auth(team.lead))
        .send({ email: other.email, role: "TESTER_CLIENT" })
        .expect(201);
      own = (await createTicket(team.tester, { title: "Tester A report" })).body.id;
    });

    it("a tester only sees their own reports in the list", async () => {
      await createTicket(other, { title: "Tester B report" }).expect(201);
      const res = await request(server())
        .get(`/projects/${team.projectId}/tickets?limit=100`)
        .set(auth(team.tester))
        .expect(200);
      expect(res.body.items.every((t: any) => t.reporter.id === team.tester.id)).toBe(true);
      const dev = await request(server())
        .get(`/projects/${team.projectId}/tickets?limit=100`)
        .set(auth(team.dev))
        .expect(200);
      expect(dev.body.total).toBeGreaterThan(res.body.total);
    });

    it("another tester gets 404 for someone else's ticket", async () => {
      await request(server()).get(`/tickets/${own}`).set(auth(other)).expect(404);
      await request(server())
        .post(`/tickets/${own}/comments`)
        .set(auth(other))
        .send({ body: "hi" })
        .expect(404);
    });

    it("outsiders get 404 on a ticket", async () => {
      const outsider = await registerUser(app);
      await request(server()).get(`/tickets/${own}`).set(auth(outsider)).expect(404);
      await request(server())
        .post(`/tickets/${own}/status`)
        .set(auth(outsider))
        .send({ status: "IN_PROGRESS" })
        .expect(404);
    });

    it("technical evidence is hidden from testers but shown to developers", async () => {
      const t = await prisma.ticket.create({
        data: {
          projectId: team.projectId,
          number: 900,
          reporterId: team.tester.id,
          title: "With evidence",
          description: "d",
          events: { create: [{ type: "ERROR", message: "boom", timestamp: new Date() }] },
        },
      });
      const asTester = await request(server()).get(`/tickets/${t.id}`).set(auth(team.tester)).expect(200);
      expect(asTester.body.events).toEqual([]);
      const asDev = await request(server()).get(`/tickets/${t.id}`).set(auth(team.dev)).expect(200);
      expect(asDev.body.events).toHaveLength(1);
    });
  });

  describe("developer actions", () => {
    let id: string;
    beforeAll(async () => {
      id = (await createTicket(team.tester, { title: "Assign me" })).body.id;
    });

    it("assigns only developers or leads", async () => {
      await request(server()).patch(`/tickets/${id}`).set(auth(team.dev)).send({ assigneeId: team.tester.id }).expect(400);
      const ok = await request(server()).patch(`/tickets/${id}`).set(auth(team.lead)).send({ assigneeId: team.dev.id }).expect(200);
      expect(ok.body.assigneeId).toBe(team.dev.id);
      const cleared = await request(server()).patch(`/tickets/${id}`).set(auth(team.dev)).send({ assigneeId: null }).expect(200);
      expect(cleared.body.assigneeId).toBeNull();
    });

    it("testers cannot edit severity, assign or link git", async () => {
      await request(server()).patch(`/tickets/${id}`).set(auth(team.tester)).send({ severity: "LOW" }).expect(403);
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.tester)).send({ branch: "fix/x" }).expect(403);
    });

    it("links a branch and a PR number; rejects empty or invalid links", async () => {
      const res = await request(server())
        .post(`/tickets/${id}/link`)
        .set(auth(team.dev))
        .send({ branch: "fix/checkout-button", prNumber: 12 })
        .expect(201);
      expect(res.body).toMatchObject({ branch: "fix/checkout-button", prNumber: 12 });
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({}).expect(400);
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({ branch: "bad branch;rm" }).expect(400);
      await request(server()).post(`/tickets/${id}/link`).set(auth(team.dev)).send({ prNumber: -4 }).expect(400);
    });

    it("marks a duplicate within the same project only", async () => {
      const orig = (await createTicket(team.tester, { title: "Original" })).body.id;
      await request(server()).post(`/tickets/${id}/duplicate`).set(auth(team.dev)).send({ duplicateOfId: orig }).expect(201);
      await request(server()).post(`/tickets/${id}/duplicate`).set(auth(team.dev)).send({ duplicateOfId: id }).expect(400);
      const other = await createProjectWithTeam(app);
      const foreign = await request(server())
        .post(`/projects/${other.projectId}/tickets`)
        .set(auth(other.lead))
        .send({ title: "Foreign", description: "x" })
        .expect(201);
      await request(server()).post(`/tickets/${id}/duplicate`).set(auth(team.dev)).send({ duplicateOfId: foreign.body.id }).expect(400);
    });

    it("comments and developer replies appear in order", async () => {
      await request(server()).post(`/tickets/${id}/comments`).set(auth(team.tester)).send({ body: "Still broken on mobile" }).expect(201);
      await request(server()).post(`/tickets/${id}/comments`).set(auth(team.dev)).send({ body: "Looking into it" }).expect(201);
      await request(server()).post(`/tickets/${id}/comments`).set(auth(team.dev)).send({ body: "" }).expect(400);
      const d = await request(server()).get(`/tickets/${id}`).set(auth(team.tester)).expect(200);
      expect(d.body.comments.map((c: any) => c.author.name)).toEqual(["Tester", "Dev"]);
    });

    it("stores comment text as plain data (XSS payload is not altered or executed)", async () => {
      const payload = '<img src=x onerror=alert(1)>';
      const res = await request(server()).post(`/tickets/${id}/comments`).set(auth(team.dev)).send({ body: payload }).expect(201);
      expect(res.body.body).toBe(payload); // escaped by React at render time
    });
  });

  describe("search, filter, sort, pagination", () => {
    let p: Team;
    beforeAll(async () => {
      p = await createProjectWithTeam(app);
      const mk = (title: string, severity: string) =>
        request(server()).post(`/projects/${p.projectId}/tickets`).set(auth(p.tester)).send({ title, description: `desc ${title}`, severity }).expect(201);
      await mk("Login fails on Safari", "HIGH");
      await mk("Footer typo", "LOW");
      await mk("Payment timeout", "BLOCKER");
      await mk("Slow search results", "MEDIUM");
      const list = await request(server()).get(`/projects/${p.projectId}/tickets`).set(auth(p.dev)).expect(200);
      const payment = list.body.items.find((t: any) => t.title === "Payment timeout");
      await request(server()).patch(`/tickets/${payment.id}`).set(auth(p.dev)).send({ assigneeId: p.dev.id }).expect(200);
      await request(server()).post(`/tickets/${payment.id}/status`).set(auth(p.dev)).send({ status: "IN_PROGRESS" }).expect(201);
    });

    const get = (qs: string) =>
      request(server()).get(`/projects/${p.projectId}/tickets?${qs}`).set(auth(p.dev)).expect(200);

    it("searches title and description, case-insensitively", async () => {
      expect((await get("q=safari")).body.items.map((t: any) => t.title)).toEqual(["Login fails on Safari"]);
      expect((await get("q=DESC%20footer")).body.total).toBe(1);
    });

    it("searches by ticket number", async () => {
      expect((await get("q=IF-2")).body.items[0].title).toBe("Footer typo");
    });

    it("filters by status, severity and assignee", async () => {
      expect((await get("status=IN_PROGRESS")).body.total).toBe(1);
      expect((await get("severity=LOW")).body.total).toBe(1);
      expect((await get("assigneeId=me")).body.total).toBe(1);
      expect((await get("assigneeId=unassigned")).body.total).toBe(3);
    });

    it("sorts and paginates", async () => {
      const bySeverity = await get("sort=severity&order=desc");
      expect(bySeverity.body.items[0].severity).toBe("BLOCKER");
      const page = await get("sort=number&order=asc&limit=2&page=2");
      expect(page.body.items.map((t: any) => t.number)).toEqual([3, 4]);
      expect(page.body).toMatchObject({ total: 4, page: 2, limit: 2 });
    });

    it("rejects invalid query values", async () => {
      await request(server()).get(`/projects/${p.projectId}/tickets?sort=password`).set(auth(p.dev)).expect(400);
      await request(server()).get(`/projects/${p.projectId}/tickets?limit=9999`).set(auth(p.dev)).expect(400);
    });
  });
});
