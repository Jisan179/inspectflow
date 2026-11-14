import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Delete,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Membership, ProjectRole } from "@prisma/client";
import {
  CurrentMembership,
  CurrentUser,
  ProjectRoles,
} from "@/common/decorators";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { BuildsService } from "./builds.service";
import { PageDto } from "@/modules/projects/dto/project.dto";
import { CreateBuildDto, DecisionDto, UpdateBuildDto } from "./dto/build.dto";

const { LEAD, DEVELOPER } = ProjectRole;

@ApiTags("Builds")
@ApiBearerAuth()
@Controller()
export class BuildsController {
  constructor(private readonly builds: BuildsService) {}

  @Get("projects/:projectId/builds")
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentMembership() membership: Membership,
    @Query() page: PageDto,
  ) {
    return this.builds.list(projectId, membership.role, page);
  }

  @ProjectRoles(LEAD, DEVELOPER)
  @Post("projects/:projectId/builds")
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBuildDto,
  ) {
    return this.builds.create(projectId, user, dto);
  }

  @ProjectRoles(LEAD, DEVELOPER)
  @Get("projects/:projectId/approvals")
  approvals(@Param("projectId", ParseUUIDPipe) projectId: string) {
    return this.builds.projectApprovals(projectId);
  }

  @Get("builds/:buildId")
  get(
    @Param("buildId", ParseUUIDPipe) buildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.builds.get(buildId, user);
  }

  @Patch("builds/:buildId")
  update(
    @Param("buildId", ParseUUIDPipe) buildId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBuildDto,
  ) {
    return this.builds.update(buildId, user, dto);
  }

  @Delete("builds/:buildId")
  remove(
    @Param("buildId", ParseUUIDPipe) buildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.builds.remove(buildId, user);
  }

  @HttpCode(200)
  @Post("builds/:buildId/ready")
  ready(
    @Param("buildId", ParseUUIDPipe) buildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.builds.markReady(buildId, user);
  }

  @Get("builds/:buildId/review")
  review(
    @Param("buildId", ParseUUIDPipe) buildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.builds.review(buildId, user);
  }

  @Post("builds/:buildId/decision")
  decide(
    @Param("buildId", ParseUUIDPipe) buildId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: DecisionDto,
  ) {
    return this.builds.decide(buildId, user, dto);
  }
}
