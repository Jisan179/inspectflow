import { SetMetadata } from "@nestjs/common";
import { ProjectRole } from "@prisma/client";

export const PROJECT_ROLES_KEY = "projectRoles";
/**
 * Restricts a route that has a projectId path param to members holding one of
 * the given roles. With no roles listed, any member of the project is allowed.
 */
export const ProjectRoles = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);
