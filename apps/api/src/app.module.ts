import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { env } from "@/config";
import { AppController } from "@/app.controller";
import { TimingInterceptor } from "@/common/interceptors/timing.interceptor";
import { JwtGuard } from "@/common/guards/jwt.guard";
import { RequestLoggerMiddleware } from "@/common/middleware/request-logger.middleware";
import { PrismaModule } from "@/providers/database/prisma.module";
import { StorageModule } from "@/providers/storage/storage.module";
import { AccessModule } from "@/modules/access/access.module";
import { ProjectRolesGuard } from "@/modules/access/project-roles.guard";
import { ActivityModule } from "@/modules/activity/activity.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { BuildsModule } from "@/modules/builds/builds.module";
import { FilesModule } from "@/modules/files/files.module";
import { GithubModule } from "@/modules/github/github.module";
import { ProjectsModule } from "@/modules/projects/projects.module";
import { ReportsModule } from "@/modules/reports/reports.module";
import { TicketsModule } from "@/modules/tickets/tickets.module";
import { UsersModule } from "@/modules/users/users.module";

@Module({
  imports: [
    // General limit per IP; stricter limits are set on login and widget routes.
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: env.NODE_ENV === "test" ? 10_000 : 300 },
    ]),
    PrismaModule,
    StorageModule,
    AccessModule,
    ActivityModule,
    FilesModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    BuildsModule,
    TicketsModule,
    ReportsModule,
    GithubModule,
  ],
  controllers: [AppController],
  providers: [
    // Guards run in this order: JWT, then project membership, then rate limit.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: ProjectRolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
