import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Response } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

/**
 * Adds an X-Response-Time header (milliseconds spent in the handler). It helps
 * check the performance target and spot slow endpoints from the browser.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = process.hrtime.bigint();
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        if (res.headersSent) return;
        const ms = Number(process.hrtime.bigint() - started) / 1_000_000;
        res.setHeader("X-Response-Time", `${ms.toFixed(1)}ms`);
      }),
    );
  }
}
