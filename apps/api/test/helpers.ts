import { INestApplication } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { ProjectRole } from "@prisma/client";
import request from "supertest";
import sharp from "sharp";
import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { PrismaService } from "@/providers/database/prisma.service";

export const WIDGET_ORIGIN = "https://staging.acme.test";

/** Boots the real application (same setup as main.ts) for e2e tests. */
export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
  });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Empties every table so each test file starts from a clean database. */
export async function resetDb(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

let counter = 0;
export async function registerUser(
  app: INestApplication,
  name = "Test User",
): Promise<TestUser> {
  const email = `user${++counter}-${Date.now()}@example.test`;
  const res = await request(app.getHttpServer())
    .post("/auth/register")
    .send({ name, email, password: "Password123" })
    .expect(201);
  return { id: res.body.user.id, email, token: res.body.accessToken };
}

export const auth = (user: TestUser) => ({
  Authorization: `Bearer ${user.token}`,
});

/** Creates a project owned by `lead` and adds one member per given role. */
export async function createProjectWithTeam(app: INestApplication) {
  const lead = await registerUser(app, "Lead");
  const dev = await registerUser(app, "Dev");
  const tester = await registerUser(app, "Tester");
  const server = app.getHttpServer();

  const created = await request(server)
    .post("/projects")
    .set(auth(lead))
    .send({ name: "Acme", allowedOrigins: [WIDGET_ORIGIN] })
    .expect(201);
  const projectId: string = created.body.id;

  for (const [user, role] of [
    [dev, ProjectRole.DEVELOPER],
    [tester, ProjectRole.TESTER_CLIENT],
  ] as const) {
    await request(server)
      .post(`/projects/${projectId}/members`)
      .set(auth(lead))
      .send({ email: user.email, role })
      .expect(201);
  }
  return { lead, dev, tester, projectId, widgetKey: created.body.widgetKey as string };
}

/** A real, valid PNG for upload tests. */
export const makePng = (color = "#336699") =>
  sharp({
    create: { width: 200, height: 120, channels: 3, background: color },
  })
    .png()
    .toBuffer();

/** Submits a widget report; returns the supertest response. */
export async function submitReport(
  app: INestApplication,
  opts: {
    key: string;
    token: string;
    payload?: Record<string, unknown>;
    file?: Buffer | null;
    mime?: string;
    origin?: string;
  },
) {
  const payload = {
    description: "The pay button does nothing",
    severity: "HIGH",
    pageUrl: `${WIDGET_ORIGIN}/checkout?token=abc123`,
    viewport: "1280x720",
    userAgent: "jest",
    events: [],
    annotations: [],
    ...opts.payload,
  };
  const req = request(app.getHttpServer())
    .post("/reports")
    .set("X-InspectFlow-Key", opts.key)
    .set("Origin", opts.origin ?? WIDGET_ORIGIN)
    .set("Authorization", `Bearer ${opts.token}`)
    .field("payload", JSON.stringify(payload));
  const file = opts.file === undefined ? await makePng() : opts.file;
  if (file) {
    req.attach("screenshot", file, {
      filename: "shot.png",
      contentType: opts.mime ?? "image/png",
    });
  }
  return req;
}

/** Logs a user in through the widget endpoint and returns its token. */
export function widgetLogin(
  app: INestApplication,
  key: string,
  email: string,
  password = "Password123",
) {
  return request(app.getHttpServer())
    .post("/widget/login")
    .set("X-InspectFlow-Key", key)
    .set("Origin", WIDGET_ORIGIN)
    .send({ email, password });
}
