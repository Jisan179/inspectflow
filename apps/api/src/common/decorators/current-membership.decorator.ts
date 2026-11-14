import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Membership } from "@prisma/client";

/** Membership of the caller in the :projectId project (set by ProjectRolesGuard). */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membership =>
    ctx.switchToHttp().getRequest().membership,
);
