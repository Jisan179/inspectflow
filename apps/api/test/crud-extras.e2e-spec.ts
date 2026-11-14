import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { existsSync } from "fs";
import { PrismaService } from "@/providers/database/prisma.service";
import { StorageService } from "@/providers/storage/storage.service";
import { ActivityService } from "@/modules/activity/activity.service";
import { RetentionService } from "@/modules/files/retention.service";
import {
  auth,
  createProjectWithTeam,
  createTestApp,
  resetDb,
  submitReport,
  widgetLogin,
} from "./helpers";

type Team = Awaited<ReturnType<typeof createProjectWithTeam>>;

describe("Full CRUD, pagination, transactions and retention (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let team: Team;
  const server = () => app.getHttpServer();

  const ticket = async (title = "Some ticket") =>
    (
      await request(server())
        .post(`/projects/${team.projectId}/tickets`)
        .set(auth(team.tester))
        .send({ title, description: "d" })
        .expect(201)
    ).body.id as string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    storage = app.get(StorageService);
    await resetDb(prisma);
    team = await createProjectWithTeam(app);
  });
  afterAll(() => app.close());

  describe("tickets: delete", () => {
    it("only the Lead can delete; files and rows are removed; project log keeps a record", async () => {
      const token = (await widgetLogin(app, team.widgetKey, team.tester.email).expect(200)).body.accessToken;
      const created = await submitReport(app, { key: team.widgetKey, token, payload: { title: "To delete" } });
      const art = await prisma.artifact.findFirstOrThrow({ where: { ticketId: created.body.id } });
      const path = (storage as any).localPath(art.storageKey);
      expect(existsSync(path)).toBe(true);

      await request(server()).delete(`/tickets/${created.body.id}`).set(auth(team.dev)).expect(403);
      await request(server()).delete(`/tickets/${created.body.id}`).set(auth(team.tester)).expect(403);
      const res = await request(server()).delete(`/tickets/${created.body.id}`).set(auth(team.lead)).expect(200);
      expect(res.body.deletedFiles).toBe(1);

      expect(existsSync(path)).toBe(false);
      expect(await prisma.ticket.count({ where: { id: created.body.id } })).toBe(0);
      expect(await prisma.artifact.count({ where: { ticketId: created.body.id } })).toBe(0);
      expect(await prisma.activityLog.count({ where: { action: "ticket.deleted" } })).toBe(1);
      await request(server()).get(`/tickets/${created.body.id}`).set(auth(team.lead)).expect(404);
      await request(server()).delete(`/tickets/${created.body.id}`).set(auth(team.lead)).expect(404);
    });
  });

  describe("comments: list, edit, delete", () => {
    let id: string;
    let devComment: string;
    let testerComment: string;
    beforeAll(async () => {
      id = await ticket("Comment target");
      devComment = (await request(server()).post(`/tickets/${id}/comments`).set(auth(team.dev)).send({ body: "dev reply" }).expect(201)).body.id;
      testerComment = (await request(server()).post(`/tickets/${id}/comments`).set(auth(team.tester)).send({ body: "tester note" }).expect(201)).body.id;
    });

    it("lists comments with pagination metadata", async () => {
      const res = await request(server()).get(`/tickets/${id}/comments?limit=1&page=2`).set(auth(team.dev)).expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 2, limit: 1 });
      expect(res.body.items).toHaveLength(1);
    });

    it("only the author edits a comment", async () => {
      await request(server()).patch(`/comments/${devComment}`).set(auth(team.lead)).send({ body: "hijack" }).expect(403);
      const ok = await request(server()).patch(`/comments/${devComment}`).set(auth(team.dev)).send({ body: "edited reply" }).expect(200);
      expect(ok.body.body).toBe("edited reply");
      await request(server()).patch(`/comments/${devComment}`).set(auth(team.dev)).send({ body: "" }).expect(400);
    });

    it("the author or the Lead deletes; others cannot", async () => {
      await request(server()).delete(`/comments/${devComment}`).set(auth(team.tester)).expect(403);
      await request(server()).delete(`/comments/${testerComment}`).set(auth(team.lead)).expect(200); // Lead moderates
      await request(server()).delete(`/comments/${devComment}`).set(auth(team.dev)).expect(200); // author
      await request(server()).delete(`/comments/${devComment}`).set(auth(team.dev)).expect(404);
    });

    it("comments of someone else's ticket stay hidden from other testers", async () => {
      const outsiderTester = await (await import("./helpers")).registerUser(app);
      await request(server())
        .post(`/projects/${team.projectId}/members`)
        .set(auth(team.lead))
        .send({ email: outsiderTester.email, role: "TESTER_CLIENT" })
        .expect(201);
      await request(server()).get(`/tickets/${id}/comments`).set(auth(outsiderTester)).expect(404);
    });
  });

  describe("builds: delete rules", () => {
    const mk = async (name: string) =>
      (await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(team.dev)).send({ name, branch: "main", commitSha: "abc1234" }).expect(201)).body.id as string;

    it("only the Lead deletes, and only builds without sign-off history", async () => {
      const draft = await mk("Draft one");
      await request(server()).delete(`/builds/${draft}`).set(auth(team.dev)).expect(403);
      await request(server()).delete(`/builds/${draft}`).set(auth(team.lead)).expect(200);
      await request(server()).get(`/builds/${draft}`).set(auth(team.lead)).expect(404);

      const review = await mk("In review");
      await request(server()).post(`/builds/${review}/ready`).set(auth(team.dev)).expect(200);
      await request(server()).delete(`/builds/${review}`).set(auth(team.lead)).expect(409);

      await request(server()).post(`/builds/${review}/decision`).set(auth(team.tester)).send({ decision: "APPROVED" }).expect(201);
      await request(server()).delete(`/builds/${review}`).set(auth(team.lead)).expect(409);
    });

    it("keeps the tickets of a deleted build (they just lose the link)", async () => {
      const b = await mk("Rejected build");
      const t = (await request(server()).post(`/projects/${team.projectId}/tickets`).set(auth(team.tester)).send({ title: "Kept ticket", description: "d", buildId: b }).expect(201)).body.id;
      await request(server()).post(`/builds/${b}/ready`).set(auth(team.dev)).expect(200);
      await request(server()).post(`/builds/${b}/decision`).set(auth(team.tester)).send({ decision: "CHANGES_REQUESTED", note: "nope" }).expect(201);
      await request(server()).delete(`/builds/${b}`).set(auth(team.lead)).expect(200);
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t } })).buildId).toBeNull();
    });
  });

  describe("members and opt-in pagination", () => {
    it("gets one member by id, and not one from another project", async () => {
      const members = (await request(server()).get(`/projects/${team.projectId}/members`).set(auth(team.lead)).expect(200)).body;
      const one = await request(server()).get(`/projects/${team.projectId}/members/${members[0].id}`).set(auth(team.dev)).expect(200);
      expect(one.body.id).toBe(members[0].id);
      const other = await createProjectWithTeam(app);
      await request(server()).get(`/projects/${other.projectId}/members/${members[0].id}`).set(auth(other.lead)).expect(404);
    });

    it("lists stay plain arrays unless page or limit is given", async () => {
      expect(Array.isArray((await request(server()).get("/projects").set(auth(team.lead)).expect(200)).body)).toBe(true);
      const paged = await request(server()).get("/projects?page=1&limit=1").set(auth(team.lead)).expect(200);
      expect(paged.body).toMatchObject({ page: 1, limit: 1 });
      expect(paged.body.items).toHaveLength(1);

      const members = await request(server()).get(`/projects/${team.projectId}/members?limit=2&page=1`).set(auth(team.lead)).expect(200);
      expect(members.body.items.length).toBeLessThanOrEqual(2);
      expect(members.body.total).toBeGreaterThanOrEqual(3);

      const builds = await request(server()).get(`/projects/${team.projectId}/builds?limit=1`).set(auth(team.lead)).expect(200);
      expect(builds.body).toHaveProperty("total");
    });
  });

  it("adds an X-Response-Time header", async () => {
    const res = await request(server()).get("/projects").set(auth(team.lead));
    expect(res.headers["x-response-time"]).toMatch(/^\d+(\.\d+)?ms$/);
  });

  describe("database transactions roll back as a unit", () => {
    it("a failure while recording a build decision leaves build and approvals unchanged", async () => {
      const b = (await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(team.dev)).send({ name: "Rollback build", branch: "main", commitSha: "abc1234" }).expect(201)).body.id;
      await request(server()).post(`/builds/${b}/ready`).set(auth(team.dev)).expect(200);

      // The decision writes an approval, updates the build, then logs the action.
      // Make the LAST step fail and check that the first two were undone.
      const spy = jest.spyOn(app.get(ActivityService), "log").mockRejectedValueOnce(new Error("simulated failure"));
      const res = await request(server()).post(`/builds/${b}/decision`).set(auth(team.tester)).send({ decision: "APPROVED" });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal server error"); // no internal details leaked
      spy.mockRestore();

      expect((await prisma.build.findUniqueOrThrow({ where: { id: b } })).status).toBe("IN_REVIEW");
      expect(await prisma.buildApproval.count({ where: { buildId: b } })).toBe(0);

      // and the same request succeeds once the failure is gone
      await request(server()).post(`/builds/${b}/decision`).set(auth(team.tester)).send({ decision: "APPROVED" }).expect(201);
    });

    it("a failure while creating a ticket leaves no ticket and no number gap", async () => {
      const before = await prisma.project.findUniqueOrThrow({ where: { id: team.projectId } });
      const spy = jest.spyOn(app.get(ActivityService), "log").mockRejectedValueOnce(new Error("simulated failure"));
      await request(server()).post(`/projects/${team.projectId}/tickets`).set(auth(team.tester)).send({ title: "Will fail", description: "d" }).expect(500);
      spy.mockRestore();
      const after = await prisma.project.findUniqueOrThrow({ where: { id: team.projectId } });
      expect(after.nextTicketNo).toBe(before.nextTicketNo); // counter increment rolled back too
      expect(await prisma.ticket.count({ where: { title: "Will fail" } })).toBe(0);
    });
  });

  describe("screenshot retention", () => {
    it("deletes screenshots of long-verified tickets only", async () => {
      const token = (await widgetLogin(app, team.widgetKey, team.tester.email).expect(200)).body.accessToken;
      const old = await submitReport(app, { key: team.widgetKey, token });
      const fresh = await submitReport(app, { key: team.widgetKey, token });
      const open = await submitReport(app, { key: team.widgetKey, token });
      const files = async (id: string) => (await prisma.artifact.findMany({ where: { ticketId: id } }));
      const oldArt = (await files(old.body.id))[0];
      const oldPath = (storage as any).localPath(oldArt.storageKey);

      const verify = async (id: string) => {
        await request(server()).post(`/tickets/${id}/status`).set(auth(team.dev)).send({ status: "RESOLVED" }).expect(201);
        await request(server()).post(`/tickets/${id}/status`).set(auth(team.tester)).send({ status: "VERIFIED" }).expect(201);
      };
      await verify(old.body.id);
      await verify(fresh.body.id);
      // age only the first ticket by 100 days
      await prisma.$executeRaw`UPDATE "Ticket" SET "updatedAt" = now() - interval '100 days' WHERE id = ${old.body.id}`;

      const retention = app.get(RetentionService);
      expect((await retention.purgeVerifiedScreenshots(0)).deleted).toBe(0); // disabled
      expect((await retention.purgeVerifiedScreenshots(90)).deleted).toBe(1);

      expect(existsSync(oldPath)).toBe(false);
      expect(await files(old.body.id)).toHaveLength(0);
      expect(await files(fresh.body.id)).toHaveLength(1); // verified but recent
      expect(await files(open.body.id)).toHaveLength(1); // not verified
      expect(await prisma.ticket.count({ where: { id: old.body.id } })).toBe(1); // ticket itself stays
    });
  });
});
