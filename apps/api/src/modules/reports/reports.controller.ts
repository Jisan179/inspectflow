import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { env } from "@/config";
import { Public } from "@/common/decorators";
import { MAX_SCREENSHOT_BYTES } from "@/modules/files/image.service";
import { WidgetLoginDto } from "./dto/report.dto";
import { ReportsService } from "./reports.service";
import { WidgetGuard, WidgetKeyOnly } from "./widget.guard";

const widgetLimit = {
  default: { limit: env.WIDGET_RATE_LIMIT_PER_MIN, ttl: 60_000 },
};

/**
 * Endpoints used by the embeddable widget. They are public (no dashboard JWT)
 * and instead protected by WidgetGuard: project key + allowed origin, then a
 * widget token for the reporter.
 */
@ApiTags("Widget")
@Public()
@UseGuards(WidgetGuard)
@Throttle(widgetLimit)
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @WidgetKeyOnly()
  @Get("widget/config")
  config(@Req() req: any) {
    return this.reports.config(req.widgetProject);
  }

  @WidgetKeyOnly()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post("widget/login")
  login(@Req() req: any, @Body() dto: WidgetLoginDto) {
    return this.reports.widgetLogin(req.widgetProject, dto);
  }

  @Post("reports")
  @UseInterceptors(
    FileInterceptor("screenshot", {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_SCREENSHOT_BYTES,
        files: 1,
        fields: 4,
        fieldSize: env.WIDGET_MAX_PAYLOAD_KB * 1024,
      },
    }),
  )
  create(
    @Req() req: any,
    @Body("payload") payload: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.reports.submit(req.widgetProject, req.user.id, payload, file);
  }
}
