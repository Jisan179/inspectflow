import { INestApplication } from "@nestjs/common";
import { ProjectRole } from "@prisma/client";
import request from "supertest";
import { PrismaService } from "@/providers/database/prisma.service";
import {
  auth,
  createProjectWithTeam,
  createTestApp,
  registerUser,
  resetDb,
} from "./helpers";

describe("Projects, memberships and per-project authorization (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
  });
  afterAll(() => app.close());

  it("creator becomes Lead and receives the widget key once", async () => {
    const lead = await registerUser(app);
    const res = await request(server())
      .post("/projects")
      .set(auth(lead))
      .send({ name: "Shop", allowedOrigins: ["https://staging.shop.test"] })
      .expect(201);
    expect(res.body.myRole).toBe("LEAD");
    expect(res.body.widgetKey).toMatch(/^if_pk_/);
    expect(res.body.apiKeyHash).toBeUndefined();

    // Later reads never include the key or hash.
    const again = await request(server()).get(`/projects/${res.body.id}`).set(auth(lead)).expect(200);
    expect(again.body.widgetKey).toBeUndefined();
    expect(again.body.apiKeyHash).toBeUndefined();
    expect(again.body.webhookSecret).toBeUndefined();

    // Only a hash is stored.
    const row = await prisma.project.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.apiKeyHash).not.toContain(res.body.widgetKey);
  });

  it("validates project input", async () => {
    const lead = await registerUser(app);
    await request(server()).post("/projects").set(auth(lead)).send({ name: "x" }).expect(400);
    await request(server())
      .post("/projects")
      .set(auth(lead))
      .send({ name: "Valid", allowedOrigins: ["not a url"] })
      .expect(400);
    await request(server())
      .post("/projects")
      .set(auth(lead))
      .send({ name: "Valid", allowedOrigins: ["https://a.test/with/path"] })
      .expect(400);
  });

  describe("cross-project isolation", () => {
    let a: Awaited<ReturnType<typeof createProjectWithTeam>>;
    let b: Awaited<ReturnType<typeof createProjectWithTeam>>;

    beforeAll(async () => {
      a = await createProjectWithTeam(app);
      b = await createProjectWithTeam(app);
    });

    it("lists only the caller's projects", async () => {
      const res = await request(server()).get("/projects").set(auth(a.lead)).expect(200);
      expect(res.body.map((p: any) => p.id)).toEqual([a.projectId]);
    });

    it.each([
      ["GET", ""],
      ["GET", "/members"],
      ["GET", "/tickets"],
      ["GET", "/builds"],
      ["GET", "/overview"],
    ])("hides project B from a user of project A: %s %s", async (_m, path) => {
      // Lead of A is not a member of B -> 404, as if it did not exist.
      await request(server())
        .get(`/projects/${b.projectId}${path}`)
        .set(auth(a.lead))
        .expect(404);
    });

    it("blocks writes on another project", async () => {
      await request(server())
        .patch(`/projects/${b.projectId}`)
        .set(auth(a.lead))
        .send({ name: "hijacked" })
        .expect(404);
      await request(server())
        .post(`/projects/${b.projectId}/members`)
        .set(auth(a.lead))
        .send({ email: a.dev.email, role: "LEAD" })
        .expect(404);
      await request(server()).delete(`/projects/${b.projectId}`).set(auth(a.lead)).expect(404);
    });

    it("a Lead of A cannot edit a membership id belonging to B", async () => {
      const members = await request(server())
        .get(`/projects/${b.projectId}/members`)
        .set(auth(b.lead))
        .expect(200);
      const victim = members.body.find((m: any) => m.role === ProjectRole.DEVELOPER);
      await request(server())
        .delete(`/projects/${a.projectId}/members/${victim.id}`)
        .set(auth(a.lead))
        .expect(404);
    });
  });

  describe("role permissions within a project", () => {
    let team: Awaited<ReturnType<typeof createProjectWithTeam>>;
    beforeAll(async () => {
      team = await createProjectWithTeam(app);
    });

    it("only the Lead can edit settings", async () => {
      const patch = (u: any) =>
        request(server()).patch(`/projects/${team.projectId}`).set(auth(u)).send({ name: "Renamed" });
      await patch(team.dev).expect(403);
      await patch(team.tester).expect(403);
      await patch(team.lead).expect(200);
    });

    it("only the Lead can manage members, rotate the key and connect GitHub", async () => {
      const outsider = await registerUser(app);
      for (const user of [team.dev, team.tester]) {
        await request(server())
          .post(`/projects/${team.projectId}/members`)
          .set(auth(user))
          .send({ email: outsider.email, role: "DEVELOPER" })
          .expect(403);
        await request(server())
          .post(`/projects/${team.projectId}/rotate-key`)
          .set(auth(user))
          .expect(403);
        await request(server())
          .patch(`/projects/${team.projectId}/github`)
          .set(auth(user))
          .send({ githubRepo: "acme/shop" })
          .expect(403);
      }
    });

    it("testers cannot see developer-only pages", async () => {
      await request(server()).get(`/projects/${team.projectId}/overview`).set(auth(team.tester)).expect(403);
      await request(server())
        .get(`/projects/${team.projectId}/webhook-deliveries`)
        .set(auth(team.tester))
        .expect(403);
    });

    it("Lead adds, changes and removes members; unknown email gives 404", async () => {
      const extra = await registerUser(app, "Extra");
      const added = await request(server())
        .post(`/projects/${team.projectId}/members`)
        .set(auth(team.lead))
        .send({ email: extra.email, role: "TESTER_CLIENT" })
        .expect(201);
      await request(server())
        .post(`/projects/${team.projectId}/members`)
        .set(auth(team.lead))
        .send({ email: extra.email, role: "TESTER_CLIENT" })
        .expect(409);
      await request(server())
        .patch(`/projects/${team.projectId}/members/${added.body.id}`)
        .set(auth(team.lead))
        .send({ role: "DEVELOPER" })
        .expect(200);
      await request(server())
        .delete(`/projects/${team.projectId}/members/${added.body.id}`)
        .set(auth(team.lead))
        .expect(200);
      await request(server())
        .post(`/projects/${team.projectId}/members`)
        .set(auth(team.lead))
        .send({ email: "ghost@example.test", role: "DEVELOPER" })
        .expect(404);
      // removed user loses access immediately
      await request(server()).get(`/projects/${team.projectId}`).set(auth(extra)).expect(404);
    });

    it("keeps at least one Lead", async () => {
      const members = await request(server())
        .get(`/projects/${team.projectId}/members`)
        .set(auth(team.lead))
        .expect(200);
      const lead = members.body.find((m: any) => m.role === "LEAD");
      await request(server())
        .delete(`/projects/${team.projectId}/members/${lead.id}`)
        .set(auth(team.lead))
        .expect(400);
      await request(server())
        .patch(`/projects/${team.projectId}/members/${lead.id}`)
        .set(auth(team.lead))
        .send({ role: "DEVELOPER" })
        .expect(400);
    });

    it("rotating the key invalidates the old one", async () => {
      const rotated = await request(server())
        .post(`/projects/${team.projectId}/rotate-key`)
        .set(auth(team.lead))
        .expect(201);
      expect(rotated.body.widgetKey).not.toBe(team.widgetKey);
      const old = await prisma.project.findFirst({
        where: { apiKeyPrefix: team.widgetKey.slice(0, 14) },
      });
      expect(old).toBeNull();
    });

    it("connects GitHub, hides the secret afterwards and enforces unique repos", async () => {
      const first = await request(server())
        .patch(`/projects/${team.projectId}/github`)
        .set(auth(team.lead))
        .send({ githubRepo: "Acme/Shop-Frontend" })
        .expect(200);
      expect(first.body.githubRepo).toBe("acme/shop-frontend");
      expect(first.body.webhookSecret).toHaveLength(32); // generated once
      expect(first.body.webhookUrl).toContain("/webhooks/github");

      const again = await request(server())
        .patch(`/projects/${team.projectId}/github`)
        .set(auth(team.lead))
        .send({ githubRepo: "acme/shop-frontend" })
        .expect(200);
      expect(again.body.webhookSecret).toBeNull();

      const other = await createProjectWithTeam(app);
      await request(server())
        .patch(`/projects/${other.projectId}/github`)
        .set(auth(other.lead))
        .send({ githubRepo: "acme/shop-frontend" })
        .expect(409);
      await request(server())
        .patch(`/projects/${team.projectId}/github`)
        .set(auth(team.lead))
        .send({ githubRepo: "bad repo name" })
        .expect(400);
    });

    it("deleting a project removes its data", async () => {
      const t = await createProjectWithTeam(app);
      await request(server()).delete(`/projects/${t.projectId}`).set(auth(t.dev)).expect(403);
      await request(server()).delete(`/projects/${t.projectId}`).set(auth(t.lead)).expect(200);
      expect(await prisma.membership.count({ where: { projectId: t.projectId } })).toBe(0);
      await request(server()).get(`/projects/${t.projectId}`).set(auth(t.lead)).expect(404);
    });
  });

  it("treats a malformed project id as not found (guard runs before pipes)", async () => {
    const user = await registerUser(app);
    await request(server()).get("/projects/not-a-uuid").set(auth(user)).expect(404);
  });
});
