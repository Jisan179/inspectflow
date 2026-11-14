import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { env } from "@/config";
import { randomSecret, sha256 } from "@/common/utils/crypto";
import { PrismaService } from "@/providers/database/prisma.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";

// Lower cost in tests so the suite stays fast; 12 rounds everywhere else.
export const BCRYPT_ROUNDS = env.NODE_ENV === "test" ? 4 : 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException("Email is already registered");

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });
    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    return this.buildSession(
      await this.verifyCredentials(dto.email, dto.password),
    );
  }

  /** Checks email + password. Also used by the widget sign-in. */
  async verifyCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same message for unknown email and wrong password (no user enumeration).
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return user;
  }

  /** Refresh tokens are single use: the old one is revoked and a new pair issued. */
  async refresh(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.buildSession(stored.user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: "Logged out" };
  }

  /** Issues an access JWT plus a stored (hashed) refresh token. */
  async buildSession(user: { id: string; email: string; name: string }) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_TTL as any },
    );
    const refreshToken = randomSecret(48);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 86_400_000),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}
