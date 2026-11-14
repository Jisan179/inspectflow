/**
 * CLI entry for screenshot retention.
 *   SCREENSHOT_RETENTION_DAYS=90 pnpm --filter @inspectflow/api retention
 * With the variable unset or 0 nothing is deleted.
 */
import { PrismaClient } from "@prisma/client";
import { RetentionService } from "../modules/files/retention.service";
import { StorageService } from "../providers/storage/storage.service";

async function main() {
  const days = Number(process.env.SCREENSHOT_RETENTION_DAYS ?? 0);
  const prisma = new PrismaClient();
  try {
    const service = new RetentionService(prisma as any, new StorageService());
    const result = await service.purgeVerifiedScreenshots(days);
    console.log(
      days > 0
        ? `Deleted ${result.deleted} screenshot(s) older than ${days} days.`
        : "SCREENSHOT_RETENTION_DAYS is not set; nothing to do.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
