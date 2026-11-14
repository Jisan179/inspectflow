import { TicketSeverity, TicketStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;

  @IsOptional()
  @IsUUID()
  buildId?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;

  // null clears the assignee
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  buildId?: string | null;
}

export class ChangeStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class LinkGitDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._\-/]+$/, { message: "branch contains invalid characters" })
  branch?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  prNumber?: number;
}

export class DuplicateDto {
  @IsUUID()
  duplicateOfId!: string;
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

export class ListTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketSeverity)
  severity?: TicketSeverity;

  // a user id, "me" or "unassigned"
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  buildId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["createdAt", "updatedAt", "severity", "status", "number"])
  sort?: "createdAt" | "updatedAt" | "severity" | "status" | "number";

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
