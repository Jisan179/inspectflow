import { Global, Module } from "@nestjs/common";
import { ProjectAccessService } from "./project-access.service";
import { ProjectRolesGuard } from "./project-roles.guard";

@Global()
@Module({
  providers: [ProjectAccessService, ProjectRolesGuard],
  exports: [ProjectAccessService, ProjectRolesGuard],
})
export class AccessModule {}
