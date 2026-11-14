import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";

/**
 * One error shape for the whole API. Stack traces and raw database messages
 * are never sent to clients; they go to the server log instead.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? exception.message;
        error = b.error ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Map common database errors to meaningful HTTP codes.
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "A record with these values already exists";
        error = "Conflict";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "Record not found";
        error = "Not Found";
      } else if (exception.code === "P2003") {
        status = HttpStatus.CONFLICT;
        message = "The record is referenced by other data";
        error = "Conflict";
      } else {
        this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      path: req.originalUrl.split("?")[0],
      timestamp: new Date().toISOString(),
    });
  }
}
