/**
 * Demo data for InspectFlow. Safe to run repeatedly: the demo project is
 * deleted and recreated, demo users are kept.
 *
 *   pnpm --filter @inspectflow/api seed
 *
 * All accounts are fictional and use the shared demo password below.
 */
import {
  ApprovalDecision,
  BuildStatus,
  EventType,
  PrismaClient,
  ProjectRole,
  TicketSeverity,
  TicketStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { sha256 } from "../src/common/utils/crypto";
import { StorageService } from "../src/providers/storage/storage.service";

const prisma = new PrismaClient();
const storage = new StorageService();

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo@12345";
export const DEMO_WIDGET_KEY =
  process.env.DEMO_WIDGET_KEY ?? "if_pk_demo_acme_staging_key_0001";
const STAGING_ORIGINS = (
  process.env.DEMO_STAGING_ORIGINS ?? "http://localhost:4000,http://127.0.0.1:4000"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const USERS = [
  { name: "Lina Lead", email: "lead@inspectflow.demo", role: ProjectRole.LEAD },
  { name: "Dev Rahman", email: "dev@inspectflow.demo", role: ProjectRole.DEVELOPER },
  { name: "Tara Tester", email: "tester@inspectflow.demo", role: ProjectRole.TESTER_CLIENT },
  { name: "Cleo Client", email: "client@inspectflow.demo", role: ProjectRole.TESTER_CLIENT },
];

/** Draws a simple fake page screenshot so seeded tickets have an image. */
async function placeholderShot(title: string, detail: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <rect width="1280" height="720" fill="#f4f6fb"/>
    <rect width="1280" height="64" fill="#1f2a44"/>
    <text x="32" y="40" font-family="Arial" font-size="22" fill="#fff">Acme Shop (staging)</text>
    <text x="64" y="150" font-family="Arial" font-size="34" font-weight="bold" fill="#1f2a44">${title}</text>
    <rect x="64" y="200" width="560" height="300" rx="12" fill="#fff" stroke="#d5dbe8"/>
    <text x="96" y="260" font-family="Arial" font-size="20" fill="#44516e">${detail}</text>
    <rect x="96" y="420" width="200" height="48" rx="8" fill="#3b6cf6"/>
    <text x="130" y="452" font-family="Arial" font-size="20" fill="#fff">Pay now</text>
    <rect x="80" y="400" width="240" height="88" rx="10" fill="none" stroke="#e5484d" stroke-width="5"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function addScreenshot(ticketId: string, projectId: string, title: string, detail: string) {
  const buffer = await placeholderShot(title, detail);
  const storageKey = `tickets/${projectId}/${randomUUID()}.png`;
  await storage.put(storageKey, buffer, "image/png");
  await prisma.artifact.create({
    data: { ticketId, kind: "SCREENSHOT", storageKey, mimeType: "image/png", sizeBytes: buffer.length },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, { id: string }> = {};
  for (const u of USERS) {
    users[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash },
      create: { name: u.name, email: u.email, passwordHash },
    });
  }

  // Reset the demo project (cascade removes its tickets, builds and members).
  const old = await prisma.project.findUnique({ where: { apiKeyPrefix: DEMO_WIDGET_KEY.slice(0, 14) } });
  if (old) {
    const files = await prisma.artifact.findMany({ where: { ticket: { projectId: old.id } } });
    await prisma.project.delete({ where: { id: old.id } });
    await Promise.all(files.map((f) => storage.delete(f.storageKey)));
  }

  const repo = process.env.DEMO_GITHUB_REPO?.toLowerCase();
  const project = await prisma.project.create({
    data: {
      name: "Acme Shop (demo)",
      description: "Demo project: a fictional web shop under client acceptance testing.",
      stagingUrl: STAGING_ORIGINS[0],
      apiKeyPrefix: DEMO_WIDGET_KEY.slice(0, 14),
      apiKeyHash: sha256(DEMO_WIDGET_KEY),
      allowedOrigins: STAGING_ORIGINS,
      githubRepo: repo ?? null,
      webhookSecret: repo ? process.env.DEMO_WEBHOOK_SECRET ?? "demo-webhook-secret-change-me" : null,
      memberships: {
        create: USERS.map((u) => ({ userId: users[u.email].id, role: u.role })),
      },
    },
  });

  const lead = users["lead@inspectflow.demo"].id;
  const dev = users["dev@inspectflow.demo"].id;
  const tester = users["tester@inspectflow.demo"].id;
  const client = users["client@inspectflow.demo"].id;

  // Build 1 was already signed off by the client, so approval history is visible.
  const build1 = await prisma.build.create({
    data: {
      projectId: project.id,
      name: "Sprint 1: catalogue",
      branch: "release/sprint-1",
      commitSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
      previewUrl: STAGING_ORIGINS[0],
      status: BuildStatus.APPROVED,
      createdAt: new Date(Date.now() - 14 * 86_400_000),
    },
  });
  await prisma.buildApproval.create({
    data: {
      buildId: build1.id,
      userId: client,
      decision: ApprovalDecision.APPROVED,
      note: "Catalogue pages look good. Approved.",
      commitSha: build1.commitSha,
      decidedAt: new Date(Date.now() - 12 * 86_400_000),
    },
  });

  // Build 2 is under review and has an unverified High ticket (blocks approval).
  const build2 = await prisma.build.create({
    data: {
      projectId: project.id,
      name: "Sprint 2: checkout",
      branch: "release/sprint-2",
      commitSha: "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432",
      previewUrl: STAGING_ORIGINS[0],
      status: BuildStatus.IN_REVIEW,
    },
  });

  const demoTickets = [
    {
      title: "Pay now button does nothing",
      description: "I click Pay now and nothing happens, no message at all.",
      severity: TicketSeverity.HIGH,
      status: TicketStatus.OPEN,
      branch: null as string | null,
      reporterId: tester,
      shot: ["Checkout", "Order total: $48.00"],
      events: [
        { type: EventType.ERROR, message: "Uncaught TypeError: Cannot read properties of undefined (reading 'submit')", stack: "TypeError: Cannot read properties of undefined\n    at onPayClick (checkout.js:42:18)" },
        { type: EventType.NETWORK, method: "POST", url: "http://localhost:4000/api/orders", statusCode: 500, durationMs: 312, message: "Internal Server Error" },
      ],
    },
    {
      title: "Product cards overlap on small screens",
      description: "On my phone the price overlaps the product name.",
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.IN_PROGRESS,
      branch: "fix/product-card-layout",
      reporterId: client,
      shot: ["Catalogue", "Layout broken at 360px width"],
      events: [{ type: EventType.CONSOLE, message: "Layout shift detected in .product-card" }],
    },
    {
      title: "Typo in footer: 'Contakt us'",
      description: "Footer link says Contakt instead of Contact.",
      severity: TicketSeverity.LOW,
      status: TicketStatus.VERIFIED,
      branch: null,
      reporterId: tester,
      shot: ["Footer", "Contakt us"],
      events: [],
    },
  ];

  let number = 1;
  for (const t of demoTickets) {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: project.id,
        number: number++,
        buildId: build2.id,
        reporterId: t.reporterId,
        assigneeId: t.status === TicketStatus.OPEN ? null : dev,
        title: t.title,
        description: t.description,
        severity: t.severity,
        status: t.status,
        branch: t.branch,
        pageUrl: `${STAGING_ORIGINS[0]}/checkout`,
        viewport: "1280x720",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36",
        resolvedAt: t.status === TicketStatus.VERIFIED ? new Date() : null,
        events: { create: t.events.map((e) => ({ ...e, timestamp: new Date() })) },
        annotations: { create: [{ type: "BOX", shapeJson: { x: 80, y: 400, width: 240, height: 88 } }] },
        comments:
          t.status === TicketStatus.IN_PROGRESS
            ? { create: [{ authorId: dev, body: "Reproduced at 360px. Working on a fix." }] }
            : undefined,
        activities: { create: [{ projectId: project.id, actorId: t.reporterId, action: "ticket.created" }] },
      },
    });
    await addScreenshot(ticket.id, project.id, t.shot[0], t.shot[1]);
  }
  await prisma.project.update({ where: { id: project.id }, data: { nextTicketNo: number } });
  await prisma.activityLog.create({
    data: { projectId: project.id, actorId: lead, action: "project.created" },
  });

  console.log("Seed complete.");
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
  console.log(`Widget key: ${DEMO_WIDGET_KEY}`);
  console.log(`Allowed origins: ${STAGING_ORIGINS.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
