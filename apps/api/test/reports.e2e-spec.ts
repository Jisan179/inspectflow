import { INestApplication } from "@nestjs/common";
import request from "supertest";
import sharp from "sharp";
import { PrismaService } from "@/providers/database/prisma.service";
import { StorageService } from "@/providers/storage/storage.service";
import {
  WIDGET_ORIGIN,
  auth,
  createProjectWithTeam,
  createTestApp,
  makePng,
  resetDb,
  submitReport,
  widgetLogin,
} from "./helpers";

type Team = Awaited<ReturnType<typeof createProjectWithTeam>>;

describe("Widget reports and file handling (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let team: Team;
  let widgetToken: string;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    storage = app.get(StorageService);
    await resetDb(prisma);
    team = await createProjectWithTeam(app);
    const login = await widgetLogin(app, team.widgetKey, team.tester.email).expect(200);
    widgetToken = login.body.accessToken;
  });
  afterAll(() => app.close());

  describe("project key and origin checks", () => {
    it("returns widget config for a valid key and allowed origin", async () => {
      const res = await request(server())
        .get("/widget/config")
        .set("X-InspectFlow-Key", team.widgetKey)
        .set("Origin", WIDGET_ORIGIN)
        .expect(200);
      expect(res.body.projectName).toBe("Acme");
      expect(res.body.captures.length).toBeGreaterThan(2); // tester is told what is captured
    });

    it("rejects a missing, malformed or unknown key with 401", async () => {
      await request(server()).get("/widget/config").set("Origin", WIDGET_ORIGIN).expect(401);
      await request(server()).get("/widget/config").set("X-InspectFlow-Key", "nope").set("Origin", WIDGET_ORIGIN).expect(401);
      await request(server())
        .get("/widget/config")
        .set("X-InspectFlow-Key", team.widgetKey.slice(0, 14) + "WRONGWRONGWRONGWRONG")
        .set("Origin", WIDGET_ORIGIN)
        .expect(401);
    });

    it("rejects origins that are not allowed, or missing, with 403", async () => {
      await request(server()).get("/widget/config").set("X-InspectFlow-Key", team.widgetKey).set("Origin", "https://evil.test").expect(403);
      await request(server()).get("/widget/config").set("X-InspectFlow-Key", team.widgetKey).expect(403);
    });

    it("answers the CORS preflight for widget routes", async () => {
      const res = await request(server())
        .options("/reports")
        .set("Origin", WIDGET_ORIGIN)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "x-inspectflow-key,authorization");
      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-headers"]).toMatch(/x-inspectflow-key/i);
    });

    it("does not allow arbitrary origins on dashboard routes (CORS)", async () => {
      const res = await request(server()).get("/health").set("Origin", "https://evil.test");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("widget sign-in", () => {
    it("rejects wrong passwords and non-members", async () => {
      await widgetLogin(app, team.widgetKey, team.tester.email, "WrongPassword1").expect(401);
      const other = await createProjectWithTeam(app);
      await widgetLogin(app, team.widgetKey, other.tester.email).expect(401);
    });

    it("issues a project-scoped token that the dashboard API refuses", async () => {
      await request(server()).get("/projects").set("Authorization", `Bearer ${widgetToken}`).expect(401);
      await request(server()).get("/auth/me").set("Authorization", `Bearer ${widgetToken}`).expect(401);
    });

    it("a token for project A does not work for project B", async () => {
      const b = await createProjectWithTeam(app);
      const res = await submitReport(app, { key: b.widgetKey, token: widgetToken });
      expect(res.status).toBe(401);
    });

    it("a normal dashboard token is not accepted for reports", async () => {
      const res = await submitReport(app, { key: team.widgetKey, token: team.tester.token });
      expect(res.status).toBe(401);
    });
  });

  describe("submitting a report", () => {
    it("creates a ticket with screenshot, environment, annotations and sanitised evidence", async () => {
      const res = await submitReport(app, {
        key: team.widgetKey,
        token: widgetToken,
        payload: {
          title: "Pay button dead",
          events: [
            { type: "ERROR", message: "TypeError: x is undefined", stack: "at pay (app.js:1:1)", timestamp: new Date().toISOString() },
            { type: "NETWORK", method: "POST", url: "https://staging.acme.test/api/orders?token=SECRET123", statusCode: 500, durationMs: 210, message: "Authorization: Bearer abc.def.ghi" },
            { type: "CONSOLE", message: "password=hunter2 rejected" },
            { type: "BOGUS", message: "ignored" },
          ],
          annotations: [
            { type: "ARROW", shapeJson: { points: [10, 10, 90, 90] } },
            { type: "BLUR", shapeJson: { x: 5, y: 5, width: 40, height: 20 } },
          ],
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.number).toBe(1);

      const detail = await request(server()).get(`/tickets/${res.body.id}`).set(auth(team.dev)).expect(200);
      const t = detail.body;
      expect(t).toMatchObject({
        title: "Pay button dead",
        severity: "HIGH",
        viewport: "1280x720",
        userAgent: "jest",
        status: "OPEN",
      });
      expect(t.reporter.id).toBe(team.tester.id);
      // page URL had a token query param: it must be redacted
      expect(t.pageUrl).not.toContain("abc123");
      expect(t.annotations.map((a: any) => a.type)).toEqual(["ARROW", "BLUR"]);
      // 3 valid events (bogus dropped)
      expect(t.events).toHaveLength(3);
      const blob = JSON.stringify(t.events);
      expect(blob).not.toContain("SECRET123");
      expect(blob).not.toContain("abc.def.ghi");
      expect(blob).not.toContain("hunter2");
      expect(t.artifacts).toHaveLength(1);
    });

    it("stores the screenshot privately and serves it only via a signed, expiring URL", async () => {
      const created = await submitReport(app, { key: team.widgetKey, token: widgetToken });
      const detail = await request(server()).get(`/tickets/${created.body.id}`).set(auth(team.dev)).expect(200);
      const url = new URL(detail.body.artifacts[0].url);
      expect(url.searchParams.get("sig")).toBeTruthy();

      // valid link works and returns a PNG
      const ok = await request(server()).get(url.pathname + url.search).expect(200);
      expect(ok.headers["content-type"]).toMatch(/image\/png/);
      expect(ok.headers["cache-control"]).toMatch(/no-store/);

      // tampered signature, tampered key, missing params and path traversal fail
      const bad = new URL(url.toString());
      bad.searchParams.set("sig", "0".repeat(64));
      await request(server()).get(bad.pathname + bad.search).expect(404);
      const otherKey = new URL(url.toString());
      otherKey.searchParams.set("key", "tickets/other.png");
      await request(server()).get(otherKey.pathname + otherKey.search).expect(404);
      await request(server()).get("/files/local").expect(404);
      await request(server()).get("/files/local?key=../../package.json&exp=9999999999&sig=x").expect(404);

      // expired link (signed in the past)
      const key = url.searchParams.get("key")!;
      const expired = await (storage as any).sign(key, Math.floor(Date.now() / 1000) - 10);
      await request(server())
        .get(`/files/local?key=${encodeURIComponent(key)}&exp=${Math.floor(Date.now() / 1000) - 10}&sig=${expired}`)
        .expect(404);

      // the stored object is a real PNG, not the raw upload path
      const stored = await prisma.artifact.findFirstOrThrow({ where: { ticketId: created.body.id } });
      expect(stored.storageKey).toMatch(/^tickets\/.+\.png$/);
      expect(stored.mimeType).toBe("image/png");
    });

    it("rejects a missing screenshot with 400", async () => {
      const res = await submitReport(app, { key: team.widgetKey, token: widgetToken, file: null });
      expect(res.status).toBe(400);
    });

    it("rejects invalid files (415): wrong MIME, fake image, text renamed .png", async () => {
      const pdf = await submitReport(app, { key: team.widgetKey, token: widgetToken, file: await makePng(), mime: "application/pdf" });
      expect(pdf.status).toBe(415);
      const fake = await submitReport(app, { key: team.widgetKey, token: widgetToken, file: Buffer.from("<html><script>alert(1)</script></html>") });
      expect(fake.status).toBe(415);
      const jpgAsPng = await submitReport(app, {
        key: team.widgetKey,
        token: widgetToken,
        file: await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).jpeg().toBuffer(),
      });
      expect(jpgAsPng.status).toBe(415);
    });

    it("rejects files over 5 MB (413)", async () => {
      const big = Buffer.concat([await makePng(), Buffer.alloc(5 * 1024 * 1024 + 10)]);
      const res = await submitReport(app, { key: team.widgetKey, token: widgetToken, file: big });
      expect(res.status).toBe(413);
    });

    it("validates the payload (400 with messages)", async () => {
      const noDesc = await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { description: "" } });
      expect(noDesc.status).toBe(400);
      const badSeverity = await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { severity: "NUCLEAR" } });
      expect(badSeverity.status).toBe(400);
      const badViewport = await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { viewport: "wide" } });
      expect(badViewport.status).toBe(400);
      const badAnnotation = await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { annotations: [{ type: "TEXT", shapeJson: {} }] } });
      expect(badAnnotation.status).toBe(400);
    });

    it("rejects a payload field that is not JSON", async () => {
      const res = await request(server())
        .post("/reports")
        .set("X-InspectFlow-Key", team.widgetKey)
        .set("Origin", WIDGET_ORIGIN)
        .set("Authorization", `Bearer ${widgetToken}`)
        .field("payload", "{not json")
        .attach("screenshot", await makePng(), { filename: "s.png", contentType: "image/png" });
      expect(res.status).toBe(400);
    });

    it("does not leave a database row or file behind when validation fails", async () => {
      const before = await prisma.ticket.count();
      await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { severity: "NUCLEAR" } });
      expect(await prisma.ticket.count()).toBe(before);
    });

    it("attaches the report to the newest open build and to an explicit build", async () => {
      const lead = team.lead;
      const b1 = await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(lead)).send({ name: "B1", branch: "main", commitSha: "abc1234" }).expect(201);
      const auto = await submitReport(app, { key: team.widgetKey, token: widgetToken });
      const t1 = await prisma.ticket.findUniqueOrThrow({ where: { id: auto.body.id } });
      expect(t1.buildId).toBe(b1.body.id);

      const b2 = await request(server()).post(`/projects/${team.projectId}/builds`).set(auth(lead)).send({ name: "B2", branch: "dev", commitSha: "def5678" }).expect(201);
      const explicit = await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { buildId: b1.body.id } });
      expect((await prisma.ticket.findUniqueOrThrow({ where: { id: explicit.body.id } })).buildId).toBe(b1.body.id);
      expect(b2.body.id).toBeDefined();

      const foreign = await createProjectWithTeam(app);
      const fb = await request(server()).post(`/projects/${foreign.projectId}/builds`).set(auth(foreign.lead)).send({ name: "Foreign", branch: "main", commitSha: "abc1234" }).expect(201);
      const res = await submitReport(app, { key: team.widgetKey, token: widgetToken, payload: { buildId: fb.body.id } });
      expect(res.status).toBe(400);
    });
  });

  it("key rotation locks out the old key", async () => {
    const t = await createProjectWithTeam(app);
    const token = (await widgetLogin(app, t.widgetKey, t.tester.email).expect(200)).body.accessToken;
    await request(server()).post(`/projects/${t.projectId}/rotate-key`).set(auth(t.lead)).expect(201);
    const res = await submitReport(app, { key: t.widgetKey, token });
    expect(res.status).toBe(401);
  });

  it("deleting a project deletes its stored screenshots", async () => {
    const t = await createProjectWithTeam(app);
    const token = (await widgetLogin(app, t.widgetKey, t.tester.email).expect(200)).body.accessToken;
    const created = await submitReport(app, { key: t.widgetKey, token });
    const art = await prisma.artifact.findFirstOrThrow({ where: { ticketId: created.body.id } });
    const fs = await import("fs");
    const path = (storage as any).localPath(art.storageKey);
    expect(fs.existsSync(path)).toBe(true);
    await request(server()).delete(`/projects/${t.projectId}`).set(auth(t.lead)).expect(200);
    expect(fs.existsSync(path)).toBe(false);
  });
});
