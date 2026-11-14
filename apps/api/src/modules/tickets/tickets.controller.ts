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
import { Membership } from "@prisma/client";
import { CurrentMembership, CurrentUser } from "@/common/decorators";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import {
  ChangeStatusDto,
  CommentDto,
  CreateTicketDto,
  DuplicateDto,
  LinkGitDto,
  ListTicketsDto,
  UpdateTicketDto,
} from "./dto/ticket.dto";
import { PageDto } from "@/modules/projects/dto/project.dto";
import { TicketsService } from "./tickets.service";

@ApiTags("Tickets")
@ApiBearerAuth()
@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // Project-scoped routes: membership is enforced by ProjectRolesGuard.

  @Get("projects/:projectId/tickets")
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @CurrentMembership() membership: Membership,
    @Query() query: ListTicketsDto,
  ) {
    return this.tickets.list(projectId, user, membership.role, query);
  }

  @Post("projects/:projectId/tickets")
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.tickets.createManual(projectId, user, dto);
  }

  // Ticket-scoped routes: the service resolves the project and checks the role.

  @Get("tickets/:ticketId")
  detail(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.getDetail(ticketId, user);
  }

  @Patch("tickets/:ticketId")
  update(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(ticketId, user, dto);
  }

  @Post("tickets/:ticketId/status")
  status(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.tickets.changeStatus(ticketId, user, dto);
  }

  @Post("tickets/:ticketId/link")
  link(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: LinkGitDto,
  ) {
    return this.tickets.linkGit(ticketId, user, dto);
  }

  @Post("tickets/:ticketId/duplicate")
  duplicate(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: DuplicateDto,
  ) {
    return this.tickets.markDuplicate(ticketId, user, dto);
  }

  @Delete("tickets/:ticketId")
  remove(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.remove(ticketId, user);
  }

  @Get("tickets/:ticketId/comments")
  comments(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
    @Query() page: PageDto,
  ) {
    return this.tickets.listComments(ticketId, user, page);
  }

  @Patch("comments/:commentId")
  editComment(
    @Param("commentId", ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CommentDto,
  ) {
    return this.tickets.updateComment(commentId, user, dto);
  }

  @Delete("comments/:commentId")
  deleteComment(
    @Param("commentId", ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.removeComment(commentId, user);
  }

  @Post("tickets/:ticketId/comments")
  comment(
    @Param("ticketId", ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CommentDto,
  ) {
    return this.tickets.addComment(ticketId, user, dto);
  }
}
