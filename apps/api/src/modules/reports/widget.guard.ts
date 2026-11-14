import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { SetMetadata } from "@nestjs/common";
import { env } from "@/config";
import { safeEqual, sha256 } from "@/common/utils/crypto";
import { PrismaService } from "@/providers/database/prisma.service";

export const WIDGET_NO_JWT = "widgetNoJwt";
/** Route needs only the project key and a valid origin (e.g. widget login). */
export const WidgetKeyOnly = () => SetMetadata(WIDGET_NO_JWT, true);

/**
 * Protects the public widget endpoints.
 *
 * 1. The X-InspectFlow-Key header must match a project (stored as a hash).
 *    The key is a public identifier, so it is not treated as a secret.
 * 2. The browser Origin header must be in the project's allowed origins. This
 *    is enforced here on the server; CORS alone only affects browsers.
 * 3. Unless the route is key-only, a widget access token (issued by
 *    /widget/login for this project) identifies the reporter.
 */
@Injectable()
export class WidgetGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const key = req.headers["x-inspectflow-key"];
    if (typeof key !== "string" || !key.startsWith("if_pk_") || key.length > 100) {
      throw new UnauthorizedException("Missing or invalid project key");
    }

    const project = await this.prisma.project.findUnique({
      where: { apiKeyPrefix: key.slice(0, 14) },
    });
    if (!project || !safeEqual(sha256(key), project.apiKeyHash)) {
      throw new UnauthorizedException("Missing or invalid project key");
    }

    const origin = req.headers.origin;
    if (!origin || !project.allowedOrigins.includes(origin)) {
      throw new ForbiddenException("This origin is not allowed for the project");
    }
    req.widgetProject = project;

    const keyOnly = this.reflector.getAllAndOverride<boolean>(WIDGET_NO_JWT, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (keyOnly) return true;

    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException("Sign in to report an issue");

    let payload: { sub: string; scope?: string; pid?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Session expired, please sign in again");
    }
    if (payload.scope !== "widget" || payload.pid !== project.id) {
      throw new UnauthorizedException("Token is not valid for this project");
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_projectId: { userId: payload.sub, projectId: project.id } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!membership) {
      throw new ForbiddenException("You are not a member of this project");
    }
    req.user = membership.user;
    req.membership = membership;
    return true;
  }
}
