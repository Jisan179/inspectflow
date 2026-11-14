import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Prisma, TicketStatus } from "@prisma/client";
import { createHmac, randomUUID } from "crypto";
import { safeEqual } from "@/common/utils/crypto";
import { PrismaService } from "@/providers/database/prisma.service";

/** GitHub signs the raw request body: "sha256=" + HMAC-SHA256(secret, body). */
export function computeSignature(secret: string, rawBody: Buffer | string) {
  return "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function isValidSignature(
  secret: string,
  rawBody: Buffer | string,
  header: string | undefined,
) {
  if (!header) return false;
  return safeEqual(computeSignature(secret, rawBody), header);
}

export interface WebhookResult {
  received: true;
  duplicate?: boolean;
  outcome?: string;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Handles one GitHub delivery.
   *
   * 1. Find the project from the repository name in the payload.
   * 2. Verify the HMAC signature with that project's secret (401 if wrong).
   * 3. Record the delivery and apply its effect in ONE transaction. The
   *    delivery id is unique, so a replayed delivery fails on insert, the
   *    transaction rolls back and nothing is applied twice.
   */
  async handle(
    event: string,
    deliveryId: string,
    signature: string | undefined,
    rawBody: Buffer | undefined,
    payload: any,
  ): Promise<WebhookResult> {
    const repo = String(payload?.repository?.full_name ?? "").toLowerCase();
    const project = repo
      ? await this.prisma.project.findUnique({ where: { githubRepo: repo } })
      : null;
    // Same error for unknown repo and bad signature: no information leak.
    if (!project?.webhookSecret || !rawBody) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    if (!isValidSignature(project.webhookSecret, rawBody, signature)) {
      // Keep a record of the rejected attempt for the delivery history.
      await this.prisma.webhookDelivery.create({
        data: {
          projectId: project.id,
          event,
          deliveryId: `${deliveryId}#invalid-${randomUUID().slice(0, 8)}`,
          signatureValid: false,
          outcome: "rejected: invalid signature",
        },
      });
      throw new UnauthorizedException("Invalid webhook signature");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // First statement: throws P2002 for a replayed delivery id.
        const delivery = await tx.webhookDelivery.create({
          data: { projectId: project.id, event, deliveryId, signatureValid: true },
        });
        const outcome = await this.applyEvent(tx, project.id, event, payload);
        await tx.webhookDelivery.update({
          where: { id: delivery.id },
          data: { outcome },
        });
        return { received: true as const, outcome };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        this.logger.log(`Ignored duplicate delivery ${deliveryId}`);
        return { received: true, duplicate: true };
      }
      throw error;
    }
  }

  private async applyEvent(
    tx: Prisma.TransactionClient,
    projectId: string,
    event: string,
    payload: any,
  ): Promise<string> {
    if (event === "ping") return "pong";
    if (event !== "pull_request") return `ignored: ${event}`;

    const pr = payload?.pull_request;
    const number: number | undefined = payload?.number ?? pr?.number;
    const branch: string | undefined = pr?.head?.ref;
    const action: string = payload?.action;
    if (!number) return "ignored: no pull request number";

    // Opened or updated PR: attach its number to tickets linked by branch.
    if (["opened", "reopened", "synchronize", "edited"].includes(action)) {
      if (!branch) return "ignored: no branch";
      const linked = await tx.ticket.updateMany({
        where: { projectId, branch, prNumber: null },
        data: { prNumber: number },
      });
      return `linked PR #${number} to ${linked.count} ticket(s)`;
    }

    if (action !== "closed") return `ignored: pull_request ${action}`;
    if (!pr?.merged) return `ignored: PR #${number} closed without merge`;

    // Merged: resolve every open ticket linked to this PR or its branch.
    const tickets = await tx.ticket.findMany({
      where: {
        projectId,
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        OR: [{ prNumber: number }, ...(branch ? [{ branch }] : [])],
      },
      select: { id: true },
    });
    if (tickets.length === 0) return `PR #${number} merged: no linked open tickets`;

    await tx.ticket.updateMany({
      where: { id: { in: tickets.map((t) => t.id) } },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: new Date(),
        prNumber: number,
      },
    });
    await tx.activityLog.createMany({
      data: tickets.map((t) => ({
        projectId,
        ticketId: t.id,
        actorId: null,
        action: "ticket.auto_resolved",
        metadata: {
          prNumber: number,
          branch: branch ?? null,
          mergedBy: pr?.merged_by?.login ?? null,
          mergeCommit: pr?.merge_commit_sha ?? null,
        },
      })),
    });
    return `resolved ${tickets.length} ticket(s) via PR #${number}`;
  }
}
