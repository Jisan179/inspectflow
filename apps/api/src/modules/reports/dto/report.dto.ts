import { TicketSeverity } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

/** Fields of the widget report. Events and annotations are checked by hand. */
export class ReportPayloadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  @MinLength(1, { message: "description is required" })
  @MaxLength(5000)
  description!: string;

  @IsEnum(TicketSeverity)
  severity!: TicketSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pageUrl?: string;

  @IsOptional()
  @Matches(/^\d{2,5}x\d{2,5}$/, { message: "viewport must look like 1280x720" })
  viewport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  userAgent?: string;

  @IsOptional()
  @IsUUID()
  buildId?: string;
}

export class WidgetLoginDto {
  @IsString()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MaxLength(72)
  password!: string;
}
