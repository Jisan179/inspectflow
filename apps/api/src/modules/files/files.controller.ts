import { Controller, Get, Header, Query, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Response } from "express";
import { Public } from "@/common/decorators";
import { StorageService } from "@/providers/storage/storage.service";

/**
 * Serves files for the local storage driver only. The URL itself is the
 * credential: it is an HMAC over key and expiry, so it stops working after the
 * signed-URL lifetime. With the S3 driver the browser talks to the bucket.
 */
@ApiExcludeController()
@Controller("files")
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get("local")
  @Header("Cache-Control", "private, no-store")
  @Header("Cross-Origin-Resource-Policy", "cross-origin")
  @Header("X-Content-Type-Options", "nosniff")
  async local(
    @Query("key") key: string,
    @Query("exp") exp: string,
    @Query("sig") sig: string,
    @Res() res: Response,
  ) {
    const data = await this.storage.readLocal(key ?? "", Number(exp), sig ?? "");
    res.setHeader("Content-Type", "image/png");
    res.send(data);
  }
}
