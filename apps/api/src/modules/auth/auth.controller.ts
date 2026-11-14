import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, Public } from "@/common/decorators";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshDto, RegisterDto } from "./dto/auth.dto";

import { env } from "@/config";

const authLimit = { default: { limit: env.AUTH_RATE_LIMIT_PER_MIN, ttl: 60_000 } };

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(authLimit)
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(authLimit)
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(200)
  @Post("logout")
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
