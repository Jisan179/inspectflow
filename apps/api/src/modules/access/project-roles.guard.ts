import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ProjectRole } from "@prisma/client";
import { PROJECT_ROLES_KEY } from "@/common/decorators/project-roles.decorator";
import { ProjectAccessService } from "./project-access.service";

/**
 * Global guard. Any route with a projectId path param requires the caller to
 * be a member of that project; ProjectRoles narrows it to specific roles.
 * The membership is attached to the request for handlers that need the role.
 */
@Injectable()
export class ProjectRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ProjectAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const projectId: string | undefined = req.params?.projectId;
    if (!projectId || !req.user) return true; // public or not project-scoped

    const roles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    req.membership = await this.access.requireMember(
      req.user.id,
      projectId,
      roles,
    );
    return true;
  }
}
