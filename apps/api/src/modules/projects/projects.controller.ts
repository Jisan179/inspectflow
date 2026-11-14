import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  AddMemberDto,
  ConnectGithubDto,
  CreateProjectDto,
  PageDto,
  UpdateMemberDto,
  UpdateProjectDto,
} from "./dto/project.dto";
import { ProjectsService } from "./projects.service";

const { LEAD, DEVELOPER } = ProjectRole;

/**
 * Routes with a projectId path param are protected by the global
 * ProjectRolesGuard; the ProjectRoles decorator narrows them to given roles.
 */
@ApiTags("Projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() page: PageDto) {
    return this.projects.listForUser(user.id, page);
  }

  @Get(":projectId")
  get(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentMembership() membership: Membership,
  ) {
    return this.projects.get(projectId, membership.role);
  }

  @ProjectRoles(LEAD)
  @Patch(":projectId")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(projectId, user.id, dto);
  }

  @ProjectRoles(LEAD)
  @Delete(":projectId")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.remove(projectId, user.id);
  }

  @ProjectRoles(LEAD)
  @Post(":projectId/rotate-key")
  rotateKey(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.rotateKey(projectId, user.id);
  }

  // ---- members ----

  @Get(":projectId/members")
  members(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() page: PageDto,
  ) {
    return this.projects.listMembers(projectId, page);
  }

  @Get(":projectId/members/:membershipId")
  member(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
  ) {
    return this.projects.getMember(projectId, membershipId);
  }

  @ProjectRoles(LEAD)
  @Post(":projectId/members")
  addMember(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.projects.addMember(projectId, user.id, dto);
  }

  @ProjectRoles(LEAD)
  @Patch(":projectId/members/:membershipId")
  updateMember(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.projects.updateMember(projectId, membershipId, user.id, dto);
  }

  @ProjectRoles(LEAD)
  @Delete(":projectId/members/:membershipId")
  removeMember(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.removeMember(projectId, membershipId, user.id);
  }

  // ---- GitHub ----

  @ProjectRoles(LEAD)
  @Patch(":projectId/github")
  connectGithub(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConnectGithubDto,
  ) {
    return this.projects.connectGithub(projectId, user.id, dto);
  }

  @ProjectRoles(LEAD, DEVELOPER)
  @Get(":projectId/webhook-deliveries")
  deliveries(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() page: PageDto,
  ) {
    return this.projects.listDeliveries(projectId, page);
  }

  // ---- overview ----

  @ProjectRoles(LEAD, DEVELOPER)
  @Get(":projectId/overview")
  overview(@Param("projectId", ParseUUIDPipe) projectId: string) {
    return this.projects.overview(projectId);
  }
}
