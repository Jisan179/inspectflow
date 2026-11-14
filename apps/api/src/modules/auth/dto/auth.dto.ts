import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

const lower = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Transform(lower)
  @IsEmail()
  @MaxLength(200)
  email!: string;

  // bcrypt only uses the first 72 bytes, so longer passwords are rejected.
  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters" })
  @MaxLength(72)
  password!: string;
}

export class LoginDto {
  @Transform(lower)
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
