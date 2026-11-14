import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { WidgetGuard } from "./widget.guard";
import { TicketsModule } from "@/modules/tickets/tickets.module";

@Module({
  imports: [TicketsModule],
  controllers: [ReportsController],
  providers: [ReportsService, WidgetGuard],
})
export class ReportsModule {}
