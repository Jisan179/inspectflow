import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "@/providers/database/prisma.service";
import { auth, createTestApp, registerUser, resetDb } from "./helpers";

describe("Authentication (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
  });
  afterAll(() => app.close());

  it("registers a user, hashes the password and never returns the hash", async () => {
    const res = await request(server())
      .post("/auth/register")
      .send({ name: "Ada", email: "Ada@Example.test", password: "Password123" })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe("ada@example.test"); // normalised
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

    const row = await prisma.user.findUniqueOrThrow({ where: { email: "ada@example.test" } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt
    expect(row.passwordHash).not.toContain("Password123");
  });

  it("rejects a duplicate email with 409", async () => {
    await request(server())
      .post("/auth/register")
      .send({ name: "Ada Two", email: "ada@example.test", password: "Password123" })
      .expect(409);
  });

  it("returns 400 with field messages for invalid input", async () => {
    const res = await request(server())
      .post("/auth/register")
      .send({ name: "A", email: "not-an-email", password: "short" })
      .expect(400);
    const text = JSON.stringify(res.body.message);
    expect(text).toMatch(/email/);
    expect(text).toMatch(/password/);
    expect(res.body.success).toBe(false);
    expect(res.body.stack).toBeUndefined();
  });

  it("rejects unknown fields (whitelist)", async () => {
    await request(server())
      .post("/auth/register")
      .send({ name: "Eve", email: "eve@example.test", password: "Password123", isAdmin: true })
      .expect(400);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(server())
      .post("/auth/login")
      .send({ email: "ada@example.test", password: "Password123" })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it("returns the same 401 for wrong password and unknown email", async () => {
    const a = await request(server())
      .post("/auth/login")
      .send({ email: "ada@example.test", password: "WrongPassword1" })
      .expect(401);
    const b = await request(server())
      .post("/auth/login")
      .send({ email: "nobody@example.test", password: "Password123" })
      .expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it("protects routes: 401 without token, with garbage token", async () => {
    await request(server()).get("/auth/me").expect(401);
    await request(server()).get("/projects").expect(401);
    await request(server()).get("/projects").set("Authorization", "Bearer garbage").expect(401);
  });

  it("returns the current user with a valid token", async () => {
    const user = await registerUser(app, "Grace");
    const res = await request(server()).get("/auth/me").set(auth(user)).expect(200);
    expect(res.body.email).toBe(user.email);
  });

  it("rejects an expired or tampered token", async () => {
    const user = await registerUser(app);
    const tampered = user.token.slice(0, -3) + "abc";
    await request(server()).get("/auth/me").set("Authorization", `Bearer ${tampered}`).expect(401);
  });

  it("rotates refresh tokens: old token stops working", async () => {
    const login = await request(server())
      .post("/auth/login")
      .send({ email: "ada@example.test", password: "Password123" })
      .expect(200);
    const first = login.body.refreshToken;

    const refreshed = await request(server())
      .post("/auth/refresh")
      .send({ refreshToken: first })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(first);

    await request(server()).post("/auth/refresh").send({ refreshToken: first }).expect(401);
  });

  it("logout revokes the refresh token", async () => {
    const login = await request(server())
      .post("/auth/login")
      .send({ email: "ada@example.test", password: "Password123" })
      .expect(200);
    await request(server())
      .post("/auth/logout")
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    await request(server())
      .post("/auth/refresh")
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it("updates the profile and requires the current password to change it", async () => {
    const user = await registerUser(app, "Old Name");
    await request(server()).patch("/users/me").set(auth(user)).send({ name: "New Name" }).expect(200);
    await request(server())
      .patch("/users/me")
      .set(auth(user))
      .send({ newPassword: "Another12345" })
      .expect(400);
    await request(server())
      .patch("/users/me")
      .set(auth(user))
      .send({ currentPassword: "bad", newPassword: "Another12345" })
      .expect(401);
    await request(server())
      .patch("/users/me")
      .set(auth(user))
      .send({ currentPassword: "Password123", newPassword: "Another12345" })
      .expect(200);
    await request(server())
      .post("/auth/login")
      .send({ email: user.email, password: "Another12345" })
      .expect(200);
  });

  it("exposes a health endpoint with database status", async () => {
    const res = await request(server()).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
  });

  it("sends security headers (Helmet)", async () => {
    const res = await request(server()).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
