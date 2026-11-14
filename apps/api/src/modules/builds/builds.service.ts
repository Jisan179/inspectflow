import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalDecision,
  BuildStatus,
  Prisma,
  ProjectRole,
  TicketStatus,
} from "@prisma/client";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { PrismaService } from "@/providers/database/prisma.service";
import { ActivityService } from "@/modules/activity/activity.service";
import { ProjectAccessService } from "@/modules/access/project-access.service";
import { blockingWhere } from "@/modules/tickets/ticket-workflow";
import { toPaging } from "@/common/utils/pagination";
import { PageDto } from "@/modules/projects/dto/project.dto";
import { CreateBuildDto, DecisionDto, UpdateBuildDto } from "./dto/build.dto";

const { DEVELOPER, LEAD, TESTER_CLIENT } = ProjectRole;

@Injectable()
export class BuildsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Clients only see builds that were shared with them, meaning builds that
   * left DRAFT. Developers and Leads see every build.
   */
  async list(projectId: string, role: ProjectRole, page?: PageDto) {
    const where = {
      projectId,
      ...(role === TESTER_CLIENT ? { status: { not: BuildStatus.DRAFT } } : {}),
    };
    const paged = page?.page !== undefined || page?.limit !== undefined;
    const { skip, take, page: p, limit } = toPaging(page ?? {});
    const [builds, total] = await Promise.all([
      this.prisma.build.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { tickets: true } } },
        ...(paged ? { skip, take } : {}),
      }),
      paged ? this.prisma.build.count({ where }) : 0,
    ]);
    const blocking = await this.prisma.ticket.groupBy({
      by: ["buildId"],
      where: { projectId, ...blockingWhere },
      _count: true,
    });
    const items = builds.map((b) => ({
      ...b,
      blockingTickets: blocking.find((x) => x.buildId === b.id)?._count ?? 0,
    }));
    return paged ? { items, total, page: p, limit } : items;
  }

  async create(projectId: string, user: AuthUser, dto: CreateBuildDto) {
    const build = await this.prisma.build.create({
      data: {
        projectId,
        name: dto.name.trim(),
        branch: dto.branch,
        commitSha: dto.commitSha.toLowerCase(),
        previewUrl: dto.previewUrl,
      },
    });
    await this.activity.log({
      projectId,
      actorId: user.id,
      action: "build.registered",
      metadata: { buildId: build.id, branch: build.branch },
    });
    return build;
  }

  /** Loads a build the caller may see (clients cannot see drafts). */
  private async loadForUser(buildId: string, userId: string) {
    const build = await this.prisma.build.findUnique({ where: { id: buildId } });
    if (!build) throw new NotFoundException("Build not found");
    const membership = await this.access.requireMember(userId, build.projectId);
    if (membership.role === TESTER_CLIENT && build.status === BuildStatus.DRAFT) {
      throw new NotFoundException("Build not found");
    }
    return { build, role: membership.role };
  }

  async get(buildId: string, user: AuthUser) {
    const { build, role } = await this.loadForUser(buildId, user.id);
    const approvals = await this.approvalHistory(buildId);
    const blocking = await this.prisma.ticket.count({
      where: { buildId, ...blockingWhere },
    });
    return { ...build, myRole: role, blockingTickets: blocking, approvals };
  }

  /**
   * Deletes a build that has no sign-off history (draft or rejected). Approved
   * and in-review builds are part of the audit trail and are kept. Tickets of
   * the build are kept and simply lose their build link.
   */
  async remove(buildId: string, user: AuthUser) {
    const build = await this.prisma.build.findUnique({ where: { id: buildId } });
    if (!build) throw new NotFoundException("Build not found");
    await this.access.requireMember(user.id, build.projectId, [LEAD]);
    if (build.status === BuildStatus.APPROVED || build.status === BuildStatus.IN_REVIEW) {
      throw new ConflictException(
        `A build that is ${build.status} cannot be deleted (it is part of the sign-off record)`,
      );
    }
    await this.prisma.build.delete({ where: { id: buildId } });
    await this.activity.log({
      projectId: build.projectId,
      actorId: user.id,
      action: "build.deleted",
      metadata: { name: build.name, branch: build.branch },
    });
    return { message: "Build deleted" };
  }

  async update(buildId: string, user: AuthUser, dto: UpdateBuildDto) {
    const build = await this.prisma.build.findUnique({ where: { id: buildId } });
    if (!build) throw new NotFoundException("Build not found");
    await this.access.requireMember(user.id, build.projectId, [DEVELOPER, LEAD]);
    if (build.status !== BuildStatus.DRAFT) {
      throw new ConflictException("Only draft builds can be edited");
    }
    return this.prisma.build.update({
      where: { id: buildId },
      data: {
        name: dto.name?.trim(),
        branch: dto.branch,
        commitSha: dto.commitSha?.toLowerCase(),
        previewUrl: dto.previewUrl,
      },
    });
  }

  /** Shares the build with clients: DRAFT -> IN_REVIEW. */
  async markReady(buildId: string, user: AuthUser) {
    const build = await this.prisma.build.findUnique({ where: { id: buildId } });
    if (!build) throw new NotFoundException("Build not found");
    await this.access.requireMember(user.id, build.projectId, [DEVELOPER, LEAD]);
    if (build.status !== BuildStatus.DRAFT) {
      throw new ConflictException(`Build is already ${build.status}`);
    }
    const updated = await this.prisma.build.update({
      where: { id: buildId },
      data: { status: BuildStatus.IN_REVIEW },
    });
    await this.activity.log({
      projectId: build.projectId,
      actorId: user.id,
      action: "build.ready_for_review",
      metadata: { buildId },
    });
    return updated;
  }

  /** Page data for the client review screen. */
  async review(buildId: string, user: AuthUser) {
    const { build, role } = await this.loadForUser(buildId, user.id);
    const ticketSelect = {
      id: true,
      number: true,
      title: true,
      severity: true,
      status: true,
    } satisfies Prisma.TicketSelect;

    const [blocking, open, verifiedCount, approvals] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { buildId, ...blockingWhere },
        select: ticketSelect,
        orderBy: { number: "asc" },
      }),
      this.prisma.ticket.findMany({
        where: { buildId, status: { not: TicketStatus.VERIFIED } },
        select: ticketSelect,
        orderBy: { number: "asc" },
      }),
      this.prisma.ticket.count({
        where: { buildId, status: TicketStatus.VERIFIED },
      }),
      this.approvalHistory(buildId),
    ]);
    return {
      build,
      myRole: role,
      blockingTickets: blocking,
      openTickets: open,
      verifiedCount,
      approvals,
      canDecide:
        role === TESTER_CLIENT && build.status === BuildStatus.IN_REVIEW,
      canApprove: blocking.length === 0,
    };
  }

  /**
   * Records the client's decision against the exact commit under review.
   *
   * Everything happens in one transaction. The build row is locked first
   * (SELECT ... FOR UPDATE) so two simultaneous decisions cannot both succeed,
   * and the blocking-ticket check sees the same data the approval is based on.
   */
  async decide(buildId: string, user: AuthUser, dto: DecisionDto) {
    const build = await this.prisma.build.findUnique({ where: { id: buildId } });
    if (!build) throw new NotFoundException("Build not found");
    await this.access.requireMember(user.id, build.projectId, [TESTER_CLIENT]);
    if (build.status === BuildStatus.DRAFT) {
      throw new NotFoundException("Build not found");
    }
    if (dto.decision === ApprovalDecision.CHANGES_REQUESTED && !dto.note?.trim()) {
      throw new BadRequestException("A note is required when requesting changes");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Build" WHERE id = ${buildId} FOR UPDATE`;
      const locked = await tx.build.findUniqueOrThrow({ where: { id: buildId } });
      if (locked.status !== BuildStatus.IN_REVIEW) {
        throw new ConflictException(
          `Build is ${locked.status} and can no longer be decided`,
        );
      }

      if (dto.decision === ApprovalDecision.APPROVED) {
        const blocking = await tx.ticket.count({
          where: { buildId, ...blockingWhere },
        });
        if (blocking > 0) {
          throw new ConflictException(
            `Cannot approve: ${blocking} blocking ticket(s) are not verified yet`,
          );
        }
      }

      const approved = dto.decision === ApprovalDecision.APPROVED;
      const approval = await tx.buildApproval.create({
        data: {
          buildId,
          userId: user.id,
          decision: dto.decision,
          note: dto.note?.trim() || null,
          commitSha: locked.commitSha,
        },
      });
      const updated = await tx.build.update({
        where: { id: buildId },
        data: { status: approved ? BuildStatus.APPROVED : BuildStatus.REJECTED },
      });
      await this.activity.log(
        {
          projectId: locked.projectId,
          actorId: user.id,
          action: approved ? "build.approved" : "build.changes_requested",
          metadata: { buildId, commitSha: locked.commitSha },
        },
        tx,
      );
      return { approval, build: updated };
    });
  }

  /** Approval history of one build, newest first. */
  private approvalHistory(buildId: string) {
    return this.prisma.buildApproval.findMany({
      where: { buildId },
      orderBy: { decidedAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  /** Approval history of a whole project (Lead / Developer view). */
  projectApprovals(projectId: string) {
    return this.prisma.buildApproval.findMany({
      where: { build: { projectId } },
      orderBy: { decidedAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        build: { select: { id: true, name: true, branch: true } },
      },
    });
  }
}
