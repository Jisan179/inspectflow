import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "@/providers/database/prisma.service";

type Db = PrismaService | Prisma.TransactionClient | PrismaClient;

export interface ActivityInput {
  projectId: string;
  ticketId?: string | null;
  actorId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes the ticket activity history and the audit log (approvals, role
 * changes, key rotation). Pass a transaction client to make the log entry
 * commit or roll back together with the change it describes.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: ActivityInput, db: Db = this.prisma) {
    return db.activityLog.create({
      data: {
        projectId: input.projectId,
        ticketId: input.ticketId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        metadata: input.metadata,
      },
    });
  }
}
