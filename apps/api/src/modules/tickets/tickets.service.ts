import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AnnotationType,
  ArtifactKind,
  BuildStatus,
  Prisma,
  ProjectRole,
  TicketSeverity,
  TicketStatus,
} from "@prisma/client";
import { PageQuery, toPaging } from "@/common/utils/pagination";
import { SanitizedEvent } from "@/common/utils/sanitize";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { PrismaService } from "@/providers/database/prisma.service";
import { StorageService } from "@/providers/storage/storage.service";
import { ActivityService } from "@/modules/activity/activity.service";
import { ProjectAccessService } from "@/modules/access/project-access.service";
import {
  ChangeStatusDto,
  CommentDto,
  CreateTicketDto,
  DuplicateDto,
  LinkGitDto,
  ListTicketsDto,
  UpdateTicketDto,
} from "./dto/ticket.dto";
import { allowedTransitions, canTransition } from "./ticket-workflow";

const { DEVELOPER, LEAD, TESTER_CLIENT } = ProjectRole;

/** Data needed to create a ticket, from the dashboard or from the widget. */
export interface NewTicketInput {
  projectId: string;
  reporterId: string;
  title: string;
  description: string;
  severity?: TicketSeverity;
  buildId?: string | null;
  pageUrl?: string | null;
  viewport?: string | null;
  userAgent?: string | null;
  events?: SanitizedEvent[];
  annotations?: { type: AnnotationType; shapeJson: Prisma.InputJsonValue }[];
  artifact?: { storageKey: string; mimeType: string; sizeBytes: number };
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  // ---------------- create ----------------

  /**
   * Creates a ticket with its evidence in one transaction. The per-project
   * ticket number comes from an incrementing counter on the project row, which
   * is locked by the update so two reports cannot get the same number.
   */
  async create(input: NewTicketInput) {
    const buildId = await this.resolveBuildId(input.projectId, input.buildId);
    return this.prisma.$transaction(async (tx) => {
      const { nextTicketNo } = await tx.project.update({
        where: { id: input.projectId },
        data: { nextTicketNo: { increment: 1 } },
        select: { nextTicketNo: true },
      });
      const ticket = await tx.ticket.create({
        data: {
          projectId: input.projectId,
          number: nextTicketNo - 1,
          buildId,
          reporterId: input.reporterId,
          title: input.title.trim(),
          description: input.description.trim(),
          severity: input.severity ?? TicketSeverity.MEDIUM,
          pageUrl: input.pageUrl,
          viewport: input.viewport,
          userAgent: input.userAgent,
          events: { create: input.events ?? [] },
          annotations: { create: input.annotations ?? [] },
          artifacts: input.artifact
            ? { create: { kind: ArtifactKind.SCREENSHOT, ...input.artifact } }
            : undefined,
        },
      });
      await this.activity.log(
        {
          projectId: input.projectId,
          ticketId: ticket.id,
          actorId: input.reporterId,
          action: "ticket.created",
          metadata: { severity: ticket.severity },
        },
        tx,
      );
      return ticket;
    });
  }

  /** Uses the given build, or the newest draft/in-review build of the project. */
  private async resolveBuildId(projectId: string, buildId?: string | null) {
    if (buildId) {
      const build = await this.prisma.build.findFirst({
        where: { id: buildId, projectId },
      });
      if (!build) throw new BadRequestException("buildId is not in this project");
      return build.id;
    }
    const latest = await this.prisma.build.findFirst({
      where: {
        projectId,
        status: { in: [BuildStatus.DRAFT, BuildStatus.IN_REVIEW] },
      },
      orderBy: { createdAt: "desc" },
    });
    return latest?.id ?? null;
  }

  createManual(projectId: string, user: AuthUser, dto: CreateTicketDto) {
    return this.create({ projectId, reporterId: user.id, ...dto });
  }

  // ---------------- list ----------------

  async list(
    projectId: string,
    user: AuthUser,
    role: ProjectRole,
    query: ListTicketsDto,
  ) {
    const where: Prisma.TicketWhereInput = { projectId };
    // Testers only see the reports they submitted.
    if (role === TESTER_CLIENT) where.reporterId = user.id;
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.buildId) where.buildId = query.buildId;
    if (query.assigneeId === "unassigned") where.assigneeId = null;
    else if (query.assigneeId === "me") where.assigneeId = user.id;
    else if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.q) {
      const q = query.q.trim();
      const number = /^#?(?:if-)?(\d+)$/i.exec(q);
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        ...(number ? [{ number: Number(number[1]) }] : []),
      ];
    }

    const { skip, take, page, limit } = toPaging(query);
    const orderBy = { [query.sort ?? "createdAt"]: query.order ?? "desc" };
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          reporter: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          build: { select: { id: true, name: true, branch: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // ---------------- detail ----------------

  /** Loads a ticket and checks the caller may see it. Returns ticket + role. */
  private async loadForUser(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    const membership = await this.access.requireMember(userId, ticket.projectId);
    // Hide other people's tickets from testers (same 404 as a missing ticket).
    if (membership.role === TESTER_CLIENT && ticket.reporterId !== userId) {
      throw new NotFoundException("Ticket not found");
    }
    return { ticket, role: membership.role };
  }

  async getDetail(ticketId: string, user: AuthUser) {
    const { ticket, role } = await this.loadForUser(ticketId, user.id);
    const full = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: {
        reporter: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        build: {
          select: { id: true, name: true, branch: true, commitSha: true, status: true },
        },
        duplicateOf: { select: { id: true, number: true, title: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
        annotations: { orderBy: { createdAt: "asc" } },
        artifacts: true,
        activities: {
          orderBy: { createdAt: "asc" },
          include: { actor: { select: { id: true, name: true } } },
        },
        // Technical evidence is for the engineering roles only.
        events:
          role === TESTER_CLIENT ? false : { orderBy: { timestamp: "asc" } },
      },
    });

    const artifacts = await Promise.all(
      full.artifacts.map(async (a) => ({
        id: a.id,
        kind: a.kind,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        url: await this.storage.signedUrl(a.storageKey),
      })),
    );
    return {
      ...full,
      artifacts,
      events: (full as any).events ?? [],
      myRole: role,
      allowedTransitions: allowedTransitions(full.status, role),
    };
  }

  // ---------------- changes ----------------

  async update(ticketId: string, user: AuthUser, dto: UpdateTicketDto) {
    const { ticket } = await this.requireEngineer(ticketId, user.id);
    const data: Prisma.TicketUncheckedUpdateInput = {};
    const changes: Record<string, unknown> = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.severity && dto.severity !== ticket.severity) {
      data.severity = dto.severity;
      changes.severity = { from: ticket.severity, to: dto.severity };
    }
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId) {
        const assignee = await this.prisma.membership.findUnique({
          where: {
            userId_projectId: { userId: dto.assigneeId, projectId: ticket.projectId },
          },
        });
        if (!assignee || assignee.role === TESTER_CLIENT) {
          throw new BadRequestException(
            "Assignee must be a Developer or Lead of this project",
          );
        }
      }
      data.assigneeId = dto.assigneeId;
      changes.assigneeId = dto.assigneeId;
    }
    if (dto.buildId !== undefined) {
      if (dto.buildId) {
        const build = await this.prisma.build.findFirst({
          where: { id: dto.buildId, projectId: ticket.projectId },
        });
        if (!build) throw new BadRequestException("buildId is not in this project");
      }
      data.buildId = dto.buildId;
      changes.buildId = dto.buildId;
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data,
    });
    if (Object.keys(changes).length) {
      await this.activity.log({
        projectId: ticket.projectId,
        ticketId,
        actorId: user.id,
        action: "ticket.updated",
        metadata: changes as Prisma.InputJsonObject,
      });
    }
    return updated;
  }

  async changeStatus(ticketId: string, user: AuthUser, dto: ChangeStatusDto) {
    const { ticket, role } = await this.loadForUser(ticketId, user.id);
    if (ticket.status === dto.status) {
      throw new BadRequestException(`Ticket is already ${ticket.status}`);
    }
    if (!canTransition(ticket.status, dto.status, role)) {
      throw new ForbiddenException(
        `A ${role} cannot move a ticket from ${ticket.status} to ${dto.status}`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: dto.status,
          resolvedAt: dto.status === TicketStatus.RESOLVED ? new Date() : null,
        },
      });
      if (dto.note?.trim()) {
        await tx.comment.create({
          data: { ticketId, authorId: user.id, body: dto.note.trim() },
        });
      }
      await this.activity.log(
        {
          projectId: ticket.projectId,
          ticketId,
          actorId: user.id,
          action: "ticket.status_changed",
          metadata: { from: ticket.status, to: dto.status },
        },
        tx,
      );
      return updated;
    });
  }

  async linkGit(ticketId: string, user: AuthUser, dto: LinkGitDto) {
    const { ticket } = await this.requireEngineer(ticketId, user.id);
    if (dto.branch === undefined && dto.prNumber === undefined) {
      throw new BadRequestException("Provide a branch or a pull request number");
    }
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { branch: dto.branch, prNumber: dto.prNumber },
    });
    await this.activity.log({
      projectId: ticket.projectId,
      ticketId,
      actorId: user.id,
      action: "ticket.git_linked",
      metadata: { branch: dto.branch ?? null, prNumber: dto.prNumber ?? null },
    });
    return updated;
  }

  async markDuplicate(ticketId: string, user: AuthUser, dto: DuplicateDto) {
    const { ticket } = await this.requireEngineer(ticketId, user.id);
    if (dto.duplicateOfId === ticketId) {
      throw new BadRequestException("A ticket cannot duplicate itself");
    }
    const original = await this.prisma.ticket.findFirst({
      where: { id: dto.duplicateOfId, projectId: ticket.projectId },
    });
    if (!original) throw new BadRequestException("Original ticket not found");
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { duplicateOfId: original.id },
    });
    await this.activity.log({
      projectId: ticket.projectId,
      ticketId,
      actorId: user.id,
      action: "ticket.marked_duplicate",
      metadata: { of: original.number },
    });
    return updated;
  }

  /** Lead only. Removes the ticket, its evidence rows and its stored screenshots. */
  async remove(ticketId: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    await this.access.requireMember(user.id, ticket.projectId, [LEAD]);
    const artifacts = await this.prisma.artifact.findMany({
      where: { ticketId },
      select: { storageKey: true },
    });
    await this.prisma.ticket.delete({ where: { id: ticketId } });
    await Promise.all(artifacts.map((a) => this.storage.delete(a.storageKey)));
    // The ticket's own activity rows are gone, so keep a project-level record.
    await this.activity.log({
      projectId: ticket.projectId,
      actorId: user.id,
      action: "ticket.deleted",
      metadata: { number: ticket.number, title: ticket.title },
    });
    return { message: "Ticket deleted", deletedFiles: artifacts.length };
  }

  async listComments(ticketId: string, user: AuthUser, page: PageQuery) {
    await this.loadForUser(ticketId, user.id);
    const { skip, take, page: p, limit } = toPaging(page);
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { ticketId },
        orderBy: { createdAt: "asc" },
        skip,
        take,
        include: { author: { select: { id: true, name: true } } },
      }),
      this.prisma.comment.count({ where: { ticketId } }),
    ]);
    return { items, total, page: p, limit };
  }

  private async loadComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { ticket: { select: { projectId: true } } },
    });
    if (!comment) throw new NotFoundException("Comment not found");
    // Same visibility rules as the ticket itself.
    await this.loadForUser(comment.ticketId, userId);
    return comment;
  }

  /** Only the author can edit a comment. */
  async updateComment(commentId: string, user: AuthUser, dto: CommentDto) {
    const comment = await this.loadComment(commentId, user.id);
    if (comment.authorId !== user.id) {
      throw new ForbiddenException("You can only edit your own comments");
    }
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body.trim() },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  /** The author or a Project Lead can delete a comment. */
  async removeComment(commentId: string, user: AuthUser) {
    const comment = await this.loadComment(commentId, user.id);
    if (comment.authorId !== user.id) {
      const membership = await this.access.requireMember(
        user.id,
        comment.ticket.projectId,
      );
      if (membership.role !== LEAD) {
        throw new ForbiddenException("You can only delete your own comments");
      }
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { message: "Comment deleted" };
  }

  async addComment(ticketId: string, user: AuthUser, dto: CommentDto) {
    const { ticket } = await this.loadForUser(ticketId, user.id);
    const comment = await this.prisma.comment.create({
      data: { ticketId, authorId: user.id, body: dto.body.trim() },
      include: { author: { select: { id: true, name: true } } },
    });
    await this.activity.log({
      projectId: ticket.projectId,
      ticketId,
      actorId: user.id,
      action: "ticket.commented",
    });
    return comment;
  }

  /** Visible ticket + caller must be a Developer or Lead of its project. */
  private async requireEngineer(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException("Ticket not found");
    await this.access.requireMember(userId, ticket.projectId, [DEVELOPER, LEAD]);
    return { ticket };
  }
}
