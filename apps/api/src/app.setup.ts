import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "@/config";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";

/** Paths used by the embeddable widget: callable from any allowed staging site. */
const isWidgetPath = (url: string) =>
  url.startsWith("/widget/") || url.startsWith("/reports");

/**
 * Shared by main.ts and the e2e tests so tests run the real configuration:
 * Helmet, CORS, global validation and the error filter.
 */
export function configureApp(app: NestExpressApplication) {
  // Render and Vercel sit behind a proxy; needed for correct client IPs.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // The API only returns JSON and images; images are shown by the web app.
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
        },
      },
    }),
  );
  app.use(cookieParser(env.COOKIE_SECRET));

  const dashboardOrigins = env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  // Dashboard routes only accept the configured web origins. Widget routes
  // answer any origin in CORS terms (no cookies involved); WidgetGuard then
  // enforces the per-project allowed-origins list on the server.
  app.enableCors((req: any, callback) => {
    const origin = req.headers.origin as string | undefined;
    if (isWidgetPath(req.url ?? "")) {
      return callback(null, {
        origin: true,
        credentials: false,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-InspectFlow-Key"],
        maxAge: 600,
      });
    }
    callback(null, {
      origin: !origin || dashboardOrigins.includes(origin),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 86_400,
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
