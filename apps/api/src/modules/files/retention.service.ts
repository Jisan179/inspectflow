import { Injectable, Logger } from "@nestjs/common";
import { TicketStatus } from "@prisma/client";
import { PrismaService } from "@/providers/database/prisma.service";
import { StorageService } from "@/providers/storage/storage.service";

/**
 * Screenshot retention. Screenshots can contain personal data, so they should
 * not live forever. This removes the stored image and its database row for
 * tickets that were VERIFIED more than `days` days ago. The ticket itself, its
 * comments and its technical evidence are kept.
 *
 * Run it from cron or a scheduler:  pnpm --filter @inspectflow/api retention
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async purgeVerifiedScreenshots(days: number, now = new Date()) {
    if (!(days > 0)) return { deleted: 0 };
    const cutoff = new Date(now.getTime() - days * 86_400_000);
    const stale = await this.prisma.artifact.findMany({
      where: { ticket: { status: TicketStatus.VERIFIED, updatedAt: { lt: cutoff } } },
      select: { id: true, storageKey: true },
    });
    for (const artifact of stale) {
      await this.storage.delete(artifact.storageKey);
    }
    await this.prisma.artifact.deleteMany({
      where: { id: { in: stale.map((a) => a.id) } },
    });
    this.logger.log(`Retention removed ${stale.length} screenshot(s) older than ${days} days`);
    return { deleted: stale.length };
  }
}
