import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

/** Injects the authenticated user (set by the JWT strategy) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
