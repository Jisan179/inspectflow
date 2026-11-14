import { ApprovalDecision } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBuildDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._\-/]+$/, { message: "branch contains invalid characters" })
  branch!: string;

  // full or abbreviated git commit SHA
  @Matches(/^[0-9a-fA-F]{7,40}$/, { message: "commitSha must be 7-40 hex characters" })
  commitSha!: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  previewUrl?: string;
}

export class UpdateBuildDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._\-/]+$/, { message: "branch contains invalid characters" })
  branch?: string;

  @IsOptional()
  @Matches(/^[0-9a-fA-F]{7,40}$/, { message: "commitSha must be 7-40 hex characters" })
  commitSha?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  previewUrl?: string;
}

export class DecisionDto {
  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
