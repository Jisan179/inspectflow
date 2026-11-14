import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

/**
 * Logs method, path, status and duration for every request and sets an
 * X-Request-Id header. Query strings are dropped so tokens never reach logs.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const started = Date.now();
    const id = randomUUID();
    res.setHeader("X-Request-Id", id);
    res.on("finish", () => {
      const path = req.originalUrl.split("?")[0];
      this.logger.log(
        `${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms [${id.slice(0, 8)}]`,
      );
    });
    next();
  }
}
