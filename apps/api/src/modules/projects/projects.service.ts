import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Project, ProjectRole, TicketStatus } from "@prisma/client";
import { env } from "@/config";
import { generateWidgetKey, randomSecret } from "@/common/utils/crypto";
import { toPaging } from "@/common/utils/pagination";
import { PrismaService } from "@/providers/database/prisma.service";
import { StorageService } from "@/providers/storage/storage.service";
import { ActivityService } from "@/modules/activity/activity.service";
import {
  AddMemberDto,
  ConnectGithubDto,
  CreateProjectDto,
  PageDto,
  UpdateMemberDto,
  UpdateProjectDto,
} from "./dto/project.dto";

/** Removes secrets before a project is returned to a client. */
export function toPublicProject(project: Project) {
  const { apiKeyHash: _hash, webhookSecret, ...rest } = project;
  return { ...rest, hasWebhookSecret: !!webhookSecret };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  /** The creator becomes Project Lead. The widget key is returned only once. */
  async create(userId: string, dto: CreateProjectDto) {
    const widget = generateWidgetKey();
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: dto.name.trim(),
          description: dto.description,
          stagingUrl: dto.stagingUrl,
          allowedOrigins: dto.allowedOrigins ?? [],
          apiKeyPrefix: widget.prefix,
          apiKeyHash: widget.hash,
          memberships: { create: { userId, role: ProjectRole.LEAD } },
        },
      });
      await this.activity.log(
        { projectId: created.id, actorId: userId, action: "project.created" },
        tx,
      );
      return created;
    });
    return { ...toPublicProject(project), myRole: ProjectRole.LEAD, widgetKey: widget.key };
  }

  /**
   * Projects the user belongs to. Pagination is opt-in: without page/limit the
   * full list is returned as an array, with them an envelope with totals.
   */
  async listForUser(userId: string, page?: PageDto) {
    const paged = page?.page !== undefined || page?.limit !== undefined;
    const { skip, take, page: p, limit } = toPaging(page ?? {});
    const [memberships, total] = await Promise.all([
      this.prisma.membership.findMany({
        where: { userId },
        include: { project: true },
        orderBy: { project: { createdAt: "desc" } },
        ...(paged ? { skip, take } : {}),
      }),
      paged ? this.prisma.membership.count({ where: { userId } }) : 0,
    ]);
    const items = memberships.map((m) => ({
      ...toPublicProject(m.project),
      myRole: m.role,
    }));
    return paged ? { items, total, page: p, limit } : items;
  }

  async get(projectId: string, role: ProjectRole) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });
    return { ...toPublicProject(project), myRole: role };
  }

  async update(projectId: string, actorId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        stagingUrl: dto.stagingUrl,
        allowedOrigins: dto.allowedOrigins,
      },
    });
    await this.activity.log({
      projectId,
      actorId,
      action: "project.updated",
      metadata: { fields: Object.keys(dto) },
    });
    return toPublicProject(project);
  }

  /** Deletes the project, its database rows (cascade) and its stored files. */
  async remove(projectId: string, _actorId: string) {
    const artifacts = await this.prisma.artifact.findMany({
      where: { ticket: { projectId } },
      select: { storageKey: true },
    });
    await this.prisma.project.delete({ where: { id: projectId } });
    await Promise.all(artifacts.map((a) => this.storage.delete(a.storageKey)));
    return { message: "Project deleted", deletedFiles: artifacts.length };
  }

  async rotateKey(projectId: string, actorId: string) {
    const widget = generateWidgetKey();
    await this.prisma.project.update({
      where: { id: projectId },
      data: { apiKeyPrefix: widget.prefix, apiKeyHash: widget.hash },
    });
    await this.activity.log({
      projectId,
      actorId,
      action: "project.key_rotated",
    });
    return { widgetKey: widget.key };
  }

  // ---------------- members ----------------

  async listMembers(projectId: string, page?: PageDto) {
    const paged = page?.page !== undefined || page?.limit !== undefined;
    const { skip, take, page: p, limit } = toPaging(page ?? {});
    const [items, total] = await Promise.all([
      this.prisma.membership.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
        ...(paged ? { skip, take } : {}),
      }),
      paged ? this.prisma.membership.count({ where: { projectId } }) : 0,
    ]);
    return paged ? { items, total, page: p, limit } : items;
  }

  async getMember(projectId: string, membershipId: string) {
    const member = await this.prisma.membership.findFirst({
      where: { id: membershipId, projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async addMember(projectId: string, actorId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException(
        "No registered user has this email. Ask them to sign up first.",
      );
    }
    const exists = await this.prisma.membership.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });
    if (exists) throw new ConflictException("User is already a member");

    const member = await this.prisma.membership.create({
      data: { projectId, userId: user.id, role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.activity.log({
      projectId,
      actorId,
      action: "member.added",
      metadata: { userId: user.id, role: dto.role },
    });
    return member;
  }

  async updateMember(
    projectId: string,
    membershipId: string,
    actorId: string,
    dto: UpdateMemberDto,
  ) {
    const member = await this.findMember(projectId, membershipId);
    if (member.role === ProjectRole.LEAD && dto.role !== ProjectRole.LEAD) {
      await this.assertAnotherLead(projectId, membershipId);
    }
    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.activity.log({
      projectId,
      actorId,
      action: "member.role_changed",
      metadata: { userId: member.userId, from: member.role, to: dto.role },
    });
    return updated;
  }

  async removeMember(projectId: string, membershipId: string, actorId: string) {
    const member = await this.findMember(projectId, membershipId);
    if (member.role === ProjectRole.LEAD) {
      await this.assertAnotherLead(projectId, membershipId);
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.activity.log({
      projectId,
      actorId,
      action: "member.removed",
      metadata: { userId: member.userId, role: member.role },
    });
    return { message: "Member removed" };
  }

  private async findMember(projectId: string, membershipId: string) {
    // projectId in the filter stops a Lead editing another project's member.
    const member = await this.prisma.membership.findFirst({
      where: { id: membershipId, projectId },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  private async assertAnotherLead(projectId: string, excludingId: string) {
    const others = await this.prisma.membership.count({
      where: { projectId, role: ProjectRole.LEAD, id: { not: excludingId } },
    });
    if (others === 0) {
      throw new BadRequestException("A project must keep at least one Lead");
    }
  }

  // ---------------- GitHub connection ----------------

  /** Stores the repository and webhook secret. The secret is echoed once. */
  async connectGithub(projectId: string, actorId: string, dto: ConnectGithubDto) {
    const repo = dto.githubRepo.toLowerCase();
    const taken = await this.prisma.project.findFirst({
      where: { githubRepo: repo, id: { not: projectId } },
    });
    if (taken) {
      throw new ConflictException("This repository is linked to another project");
    }
    const current = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });
    let secret = dto.webhookSecret;
    let generated: string | undefined;
    if (!secret && (dto.regenerateSecret || !current.webhookSecret)) {
      secret = generated = randomSecret(24);
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { githubRepo: repo, ...(secret ? { webhookSecret: secret } : {}) },
    });
    await this.activity.log({
      projectId,
      actorId,
      action: "github.connected",
      metadata: { repo },
    });
    return {
      githubRepo: repo,
      webhookUrl: `${env.PUBLIC_API_URL}/webhooks/github`,
      // Shown only when the server generated it; copy it into GitHub now.
      webhookSecret: generated ?? null,
    };
  }

  async listDeliveries(projectId: string, page: PageDto) {
    const { skip, take, page: p, limit } = toPaging(page);
    const [items, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: { projectId },
        orderBy: { processedAt: "desc" },
        skip,
        take,
      }),
      this.prisma.webhookDelivery.count({ where: { projectId } }),
    ]);
    return { items, total, page: p, limit };
  }

  // ---------------- overview ----------------

  async overview(projectId: string) {
    const [byStatus, bySeverity, builds, approvals, activity] =
      await Promise.all([
        this.prisma.ticket.groupBy({
          by: ["status"],
          where: { projectId },
          _count: true,
        }),
        this.prisma.ticket.groupBy({
          by: ["severity"],
          where: { projectId },
          _count: true,
        }),
        this.prisma.build.groupBy({
          by: ["status"],
          where: { projectId },
          _count: true,
        }),
        this.prisma.buildApproval.findMany({
          where: { build: { projectId } },
          orderBy: { decidedAt: "desc" },
          take: 10,
          include: {
            user: { select: { name: true } },
            build: { select: { name: true, branch: true } },
          },
        }),
        this.prisma.activityLog.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { actor: { select: { name: true } } },
        }),
      ]);
    const count = (rows: { _count: number }[]) =>
      rows.reduce((n, r) => n + r._count, 0);
    return {
      tickets: {
        total: count(byStatus),
        open: byStatus.find((r) => r.status === TicketStatus.OPEN)?._count ?? 0,
        inProgress:
          byStatus.find((r) => r.status === TicketStatus.IN_PROGRESS)?._count ?? 0,
        resolved:
          byStatus.find((r) => r.status === TicketStatus.RESOLVED)?._count ?? 0,
        verified:
          byStatus.find((r) => r.status === TicketStatus.VERIFIED)?._count ?? 0,
        bySeverity: Object.fromEntries(bySeverity.map((r) => [r.severity, r._count])),
      },
      builds: Object.fromEntries(builds.map((r) => [r.status, r._count])),
      approvals,
      activity,
    };
  }
}
