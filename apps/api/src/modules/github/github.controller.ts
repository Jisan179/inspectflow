import { Body, Controller, Headers, HttpCode, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "@/common/decorators";
import { GithubService } from "./github.service";

@ApiTags("GitHub")
@Controller("webhooks")
export class GithubController {
  constructor(private readonly github: GithubService) {}

  /**
   * GitHub calls this endpoint. It is public because GitHub has no JWT; the
   * HMAC-SHA256 signature of the raw body is the authentication.
   */
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post("github")
  receive(
    @Req() req: { rawBody?: Buffer },
    @Headers("x-github-event") event: string,
    @Headers("x-github-delivery") deliveryId: string,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Body() payload: any,
  ) {
    return this.github.handle(
      event ?? "unknown",
      deliveryId ?? "missing-delivery-id",
      signature,
      req.rawBody,
      payload,
    );
  }
}
