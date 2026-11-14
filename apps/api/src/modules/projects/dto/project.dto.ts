import { ProjectRole } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

// An origin is scheme + host (+ port) with no path, e.g. https://staging.acme.com
const ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;
const originMsg = "each allowed origin must look like https://host[:port]";

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  stagingUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(ORIGIN, { each: true, message: originMsg })
  allowedOrigins?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["http", "https"] })
  stagingUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(ORIGIN, { each: true, message: originMsg })
  allowedOrigins?: string[];
}

export class AddMemberDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsEnum(ProjectRole)
  role!: ProjectRole;
}

export class UpdateMemberDto {
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}

export class ConnectGithubDto {
  // owner/repo, for example acme/shop-frontend
  @Matches(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, {
    message: "githubRepo must look like owner/repo",
  })
  githubRepo!: string;

  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(200)
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  regenerateSecret?: boolean;
}

export class PageDto {
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
