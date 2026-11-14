import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { UpdateProfileDto } from "./dto/user.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch("me")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }
}
