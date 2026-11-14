// Low limits must be set BEFORE the application modules are loaded.
process.env.AUTH_RATE_LIMIT_PER_MIN = "3";
process.env.WIDGET_RATE_LIMIT_PER_MIN = "3";

import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PrismaService } from "@/providers/database/prisma.service";
import { WIDGET_ORIGIN, auth, createTestApp, registerUser, resetDb } from "./helpers";

describe("Rate limiting (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
  });
  afterAll(() => app.close());

  it("throttles repeated login attempts with 429", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "x@example.test", password: "WrongPassword1" });
      codes.push(res.status);
    }
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes.slice(3)).toEqual([429, 429]);
  });

  it("throttles widget endpoints per client", async () => {
    // Use a fresh project key; the key itself is unknown so each call is 401,
    // but the throttler counts them and starts answering 429.
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .get("/widget/config")
        .set("X-InspectFlow-Key", "if_pk_unknown_key_value")
        .set("Origin", WIDGET_ORIGIN);
      codes.push(res.status);
    }
    expect(codes.slice(0, 3).every((c) => c === 401)).toBe(true);
    expect(codes.slice(3).every((c) => c === 429)).toBe(true);
  });
});
