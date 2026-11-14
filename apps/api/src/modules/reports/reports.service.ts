import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AnnotationType, Prisma, Project } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { randomUUID } from "crypto";
import { env } from "@/config";
import { sanitizeEvents, sanitizeUrl, truncate } from "@/common/utils/sanitize";
import { PrismaService } from "@/providers/database/prisma.service";
import { StorageService } from "@/providers/storage/storage.service";
import { AuthService } from "@/modules/auth/auth.service";
import { ImageService, MAX_SCREENSHOT_BYTES } from "@/modules/files/image.service";
import { TicketsService } from "@/modules/tickets/tickets.service";
import { ReportPayloadDto, WidgetLoginDto } from "./dto/report.dto";

const MAX_ANNOTATIONS = 50;
const MAX_SHAPE_BYTES = 4000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly images: ImageService,
    private readonly storage: StorageService,
    private readonly tickets: TicketsService,
  ) {}

  config(project: Project) {
    return {
      projectName: project.name,
      maxScreenshotBytes: MAX_SCREENSHOT_BYTES,
      // Shown to the tester before they send anything.
      captures: [
        "A screenshot of this page (blurred areas are removed before upload)",
        "Page URL, browser and screen size",
        "Recent console errors and unhandled exceptions",
        "Failed network requests (URL, method, status), without headers or bodies",
      ],
    };
  }

  /**
   * Widget sign-in. The token is scoped to one project and expires after two
   * hours; the dashboard API rejects it (see JwtStrategy).
   */
  async widgetLogin(project: Project, dto: WidgetLoginDto) {
    const user = await this.auth.verifyCredentials(
      dto.email.trim().toLowerCase(),
      dto.password,
    );
    const membership = await this.prisma.membership.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
    });
    if (!membership) {
      throw new UnauthorizedException("You are not a member of this project");
    }
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, scope: "widget", pid: project.id },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: "2h" },
    );
    return {
      accessToken,
      user: { id: user.id, name: user.name },
      role: membership.role,
    };
  }

  /** Validates the multipart payload, stores the screenshot, creates the ticket. */
  async submit(
    project: Project,
    userId: string,
    rawPayload: string | undefined,
    file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    const payload = await this.parsePayload(rawPayload);
    const image = await this.images.validateAndProcess(file?.buffer, file?.mimetype);

    const storageKey = `tickets/${project.id}/${randomUUID()}.png`;
    await this.storage.put(storageKey, image.buffer, image.mimeType);

    try {
      const ticket = await this.tickets.create({
        projectId: project.id,
        reporterId: userId,
        title: payload.dto.title?.trim() || truncate(payload.dto.description.trim(), 80),
        description: payload.dto.description,
        severity: payload.dto.severity,
        buildId: payload.dto.buildId,
        pageUrl: sanitizeUrl(payload.dto.pageUrl, 2000),
        viewport: payload.dto.viewport,
        userAgent: payload.dto.userAgent,
        events: sanitizeEvents(payload.events),
        annotations: payload.annotations,
        artifact: {
          storageKey,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
        },
      });
      return { id: ticket.id, number: ticket.number, status: ticket.status };
    } catch (error) {
      // Do not leave an orphan file when the database write fails.
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  private async parsePayload(raw: string | undefined) {
    if (!raw) throw new BadRequestException("payload field is required");
    if (raw.length > env.WIDGET_MAX_PAYLOAD_KB * 1024) {
      throw new BadRequestException("payload is too large");
    }
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new BadRequestException("payload must be valid JSON");
    }
    const dto = plainToInstance(ReportPayloadDto, json);
    const errors = await validate(dto, { whitelist: true });
    if (errors.length) {
      throw new BadRequestException(
        errors.flatMap((e) => Object.values(e.constraints ?? {})),
      );
    }
    return { dto, events: json.events, annotations: this.parseAnnotations(json.annotations) };
  }

  private parseAnnotations(list: unknown) {
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.length > MAX_ANNOTATIONS) {
      throw new BadRequestException(`annotations must be an array of at most ${MAX_ANNOTATIONS}`);
    }
    return list.map((item: any) => {
      const type = item?.type as AnnotationType;
      if (!Object.values(AnnotationType).includes(type)) {
        throw new BadRequestException("annotation type must be ARROW, BOX or BLUR");
      }
      const shape = item?.shapeJson;
      if (
        !shape ||
        typeof shape !== "object" ||
        JSON.stringify(shape).length > MAX_SHAPE_BYTES
      ) {
        throw new BadRequestException("annotation shapeJson is invalid");
      }
      return { type, shapeJson: shape as Prisma.InputJsonValue };
    });
  }
}
