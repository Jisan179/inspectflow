import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Membership, ProjectRole } from "@prisma/client";
import { PrismaService } from "@/providers/database/prisma.service";

/**
 * The single place where per-project authorization is decided.
 * A user's permissions come from their Membership row for that project.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the membership or throws. Non-members get 404 so the existence of
   * other projects is not revealed; members with the wrong role get 403.
   */
  async requireMember(
    userId: string,
    projectId: string,
    roles?: ProjectRole[],
  ): Promise<Membership> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!membership) throw new NotFoundException("Project not found");
    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException(
        "Your project role does not allow this action",
      );
    }
    return membership;
  }
}
