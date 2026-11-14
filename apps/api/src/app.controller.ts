import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "@/common/decorators";
import { PrismaService } from "@/providers/database/prisma.service";

@ApiTags("Health")
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /** Used by Render and uptime pingers; checks the database connection too. */
  @Public()
  @SkipThrottle()
  @Get("health")
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
    return { status: "ok", database: "up", time: new Date().toISOString() };
  }

  @Public()
  @SkipThrottle()
  @Get()
  root() {
    return { name: "InspectFlow API", docs: "/api/docs", health: "/health" };
  }
}
