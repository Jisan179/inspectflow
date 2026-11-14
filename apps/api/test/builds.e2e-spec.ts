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

describe("Builds and client approval (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let team: Team;
  const server = () => app.getHttpServer();

  const createBuild = async (over: Record<string, unknown> = {}) =>
    (
      await request(server())
        .post(`/projects/${team.projectId}/builds`)
        .set(auth(team.dev))
        .send({ name: "Sprint", branch: "release/s1", commitSha: "ABCDEF1234567", previewUrl: "https://preview.acme.test", ...over })
        .expect(201)
    ).body;

  const ticketIn = async (buildId: string, severity: string, title = "Issue") =>
    (
      await request(server())
        .post(`/projects/${team.projectId}/tickets`)
        .set(auth(team.tester))
        .send({ title, description: "d", severity, buildId })
        .expect(201)
    ).body.id as string;

  const decide = (user: any, buildId: string, decision: string, note?: string) =>
    request(server()).post(`/builds/${buildId}/decision`).set(auth(user)).send({ decision, note });

  const ready = (buildId: string) =>
    request(server()).post(`/builds/${buildId}/ready`).set(auth(team.dev)).expect(200);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
    team = await createProjectWithTeam(app);
  });
  afterAll(() => app.close());

  describe("build management", () => {
    it("developers register builds; commit SHA is stored lower-case", async () => {
      const b = await createBuild();
      expect(b).toMatchObject({ status: "DRAFT", branch: "release/s1", commitSha: "abcdef1234567" });
    });

    it("testers cannot register or edit builds", async () => {
      await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(team.tester)).send({ name: "X", branch: "a", commitSha: "abc1234" }).expect(403);
      const b = await createBuild();
      await request(server()).patch(`/builds/${b.id}`).set(auth(team.tester)).send({ name: "Hack" }).expect(403);
      await request(server()).post(`/builds/${b.id}/ready`).set(auth(team.tester)).expect(403);
    });

    it("validates branch and commit SHA", async () => {
      await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(team.dev)).send({ name: "Bad", branch: "ok", commitSha: "zzz" }).expect(400);
      await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(team.dev)).send({ name: "Bad", branch: "bad branch!", commitSha: "abc1234" }).expect(400);
    });

    it("draft builds are hidden from clients until marked ready", async () => {
      const b = await createBuild({ name: "Hidden" });
      const before = await request(server()).get(`/projects/${team.projectId}/builds`).set(auth(team.tester)).expect(200);
      expect(before.body.find((x: any) => x.id === b.id)).toBeUndefined();
      await request(server()).get(`/builds/${b.id}`).set(auth(team.tester)).expect(404);
      await request(server()).get(`/builds/${b.id}/review`).set(auth(team.tester)).expect(404);
      await decide(team.tester, b.id, "APPROVED").expect(404);

      await ready(b.id);
      const after = await request(server()).get(`/projects/${team.projectId}/builds`).set(auth(team.tester)).expect(200);
      expect(after.body.find((x: any) => x.id === b.id)).toBeDefined();
    });

    it("only drafts can be edited and a build is marked ready once", async () => {
      const b = await createBuild();
      await request(server()).patch(`/builds/${b.id}`).set(auth(team.dev)).send({ name: "Renamed" }).expect(200);
      await ready(b.id);
      await request(server()).patch(`/builds/${b.id}`).set(auth(team.dev)).send({ name: "Late" }).expect(409);
      await request(server()).post(`/builds/${b.id}/ready`).set(auth(team.dev)).expect(409);
    });

    it("outsiders cannot see builds of the project", async () => {
      const b = await createBuild();
      const outsider = await registerUser(app);
      await request(server()).get(`/builds/${b.id}`).set(auth(outsider)).expect(404);
      await request(server()).post(`/builds/${b.id}/decision`).set(auth(outsider)).send({ decision: "APPROVED" }).expect(404);
    });
  });

  describe("approval rules", () => {
    it("blocks approval while a High/Blocker ticket is not verified, then allows it", async () => {
      const b = await createBuild({ name: "Approve me", commitSha: "1111111aaaa" });
      const high = await ticketIn(b.id, "HIGH", "Broken checkout");
      await ticketIn(b.id, "LOW", "Typo"); // non-blocking
      await ready(b.id);

      const review = await request(server()).get(`/builds/${b.id}/review`).set(auth(team.tester)).expect(200);
      expect(review.body.canApprove).toBe(false);
      expect(review.body.canDecide).toBe(true);
      expect(review.body.blockingTickets.map((t: any) => t.title)).toEqual(["Broken checkout"]);
      expect(review.body.openTickets).toHaveLength(2);

      const blocked = await decide(team.tester, b.id, "APPROVED", "ship it").expect(409);
      expect(blocked.body.message).toMatch(/1 blocking ticket/);
      expect((await prisma.build.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("IN_REVIEW");
      expect(await prisma.buildApproval.count({ where: { buildId: b.id } })).toBe(0);

      // developer resolves; still blocking until the tester verifies
      await request(server()).post(`/tickets/${high}/status`).set(auth(team.dev)).send({ status: "RESOLVED" }).expect(201);
      await decide(team.tester, b.id, "APPROVED").expect(409);
      await request(server()).post(`/tickets/${high}/status`).set(auth(team.tester)).send({ status: "VERIFIED" }).expect(201);

      const ok = await decide(team.tester, b.id, "APPROVED", "Looks good").expect(201);
      expect(ok.body.build.status).toBe("APPROVED");
      expect(ok.body.approval).toMatchObject({
        decision: "APPROVED",
        note: "Looks good",
        commitSha: "1111111aaaa", // approval is tied to the exact commit
        userId: team.tester.id,
      });
      expect(ok.body.approval.decidedAt).toBeTruthy();

      const log = await prisma.activityLog.findFirst({ where: { action: "build.approved" } });
      expect(log?.metadata).toMatchObject({ commitSha: "1111111aaaa" });
    });

    it("keeps the approved commit even if the build row changes later", async () => {
      const b = await createBuild({ commitSha: "2222222bbbb" });
      await ready(b.id);
      await decide(team.tester, b.id, "APPROVED").expect(201);
      const approval = await prisma.buildApproval.findFirstOrThrow({ where: { buildId: b.id } });
      expect(approval.commitSha).toBe("2222222bbbb");
    });

    it("a decided build cannot be decided again (409)", async () => {
      const b = await createBuild();
      await ready(b.id);
      await decide(team.tester, b.id, "APPROVED").expect(201);
      await decide(team.tester, b.id, "CHANGES_REQUESTED", "too late").expect(409);
      await decide(team.tester, b.id, "APPROVED").expect(409);
    });

    it("two simultaneous decisions produce exactly one approval record", async () => {
      const b = await createBuild();
      await ready(b.id);
      const results = await Promise.all([
        decide(team.tester, b.id, "APPROVED"),
        decide(team.tester, b.id, "APPROVED"),
        decide(team.tester, b.id, "CHANGES_REQUESTED", "race"),
      ]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await prisma.buildApproval.count({ where: { buildId: b.id } })).toBe(1);
    });

    it("request changes needs a note, rejects the build and keeps history", async () => {
      const b = await createBuild({ name: "Needs work" });
      await ready(b.id);
      await decide(team.tester, b.id, "CHANGES_REQUESTED").expect(400);
      const res = await decide(team.tester, b.id, "CHANGES_REQUESTED", "Header overlaps menu").expect(201);
      expect(res.body.build.status).toBe("REJECTED");

      const detail = await request(server()).get(`/builds/${b.id}`).set(auth(team.tester)).expect(200);
      expect(detail.body.approvals[0]).toMatchObject({ decision: "CHANGES_REQUESTED", note: "Header overlaps menu" });
      expect(detail.body.approvals[0].user.name).toBe("Tester");
    });

    it("only a Tester/Client may decide: developers and leads get 403", async () => {
      const b = await createBuild();
      await ready(b.id);
      await decide(team.dev, b.id, "APPROVED").expect(403);
      await decide(team.lead, b.id, "APPROVED").expect(403);
      expect((await prisma.build.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("IN_REVIEW");
    });

    it("validates the decision value", async () => {
      const b = await createBuild();
      await ready(b.id);
      await decide(team.tester, b.id, "MAYBE").expect(400);
    });

    it("a client of another project cannot approve this build", async () => {
      const b = await createBuild();
      await ready(b.id);
      const other = await createProjectWithTeam(app);
      await decide(other.tester, b.id, "APPROVED").expect(404);
    });
  });

  it("shows approval history to developers and leads, not to testers", async () => {
    const res = await request(server()).get(`/projects/${team.projectId}/approvals`).set(auth(team.lead)).expect(200);
    expect(res.body.length).toBeGreaterThan(2);
    expect(res.body[0].build.name).toBeDefined();
    await request(server()).get(`/projects/${team.projectId}/approvals`).set(auth(team.tester)).expect(403);
  });

  it("lists builds with their blocking-ticket counts", async () => {
    const b = await createBuild({ name: "Counted" });
    await ticketIn(b.id, "BLOCKER");
    const res = await request(server()).get(`/projects/${team.projectId}/builds`).set(auth(team.dev)).expect(200);
    expect(res.body.find((x: any) => x.id === b.id).blockingTickets).toBe(1);
  });
});
