import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "@/providers/database/prisma.service";
import { BCRYPT_ROUNDS } from "@/modules/auth/auth.service";
import { UpdateProfileDto } from "./dto/user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: { name?: string; passwordHash?: string } = {};
    if (dto.name) data.name = dto.name.trim();

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException("currentPassword is required");
      }
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
        throw new UnauthorizedException("Current password is incorrect");
      }
      data.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    // Changing the password signs out every other session.
    if (data.passwordHash) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return this.getProfile(userId);
  }
}
