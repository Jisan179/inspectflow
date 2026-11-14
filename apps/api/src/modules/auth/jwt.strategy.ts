import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { env } from "@/config";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { PrismaService } from "@/providers/database/prisma.service";

/**
 * Verifies signature and expiry of the bearer token, then loads the user so a
 * deleted account cannot keep using an unexpired token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: { sub: string; scope?: string }): Promise<AuthUser> {
    // Widget tokens are limited to the widget endpoints.
    if (payload.scope) throw new UnauthorizedException("Invalid token scope");
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new UnauthorizedException("Account no longer exists");
    return user;
  }
}
