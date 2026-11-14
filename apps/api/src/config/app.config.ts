import { z, ZodError } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

// Every environment variable the API reads is declared and validated here,
// so a missing secret fails at start-up instead of at the first request.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5001),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().default("http://localhost:5001"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  COOKIE_SECRET: z.string().default("dev-cookie-secret"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().default("inspectflow-screenshots"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(300),
  WIDGET_MAX_PAYLOAD_KB: z.coerce.number().default(2048),
  WIDGET_RATE_LIMIT_PER_MIN: z.coerce.number().default(20),
  SCREENSHOT_RETENTION_DAYS: z.coerce.number().default(0),
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().default(10),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  try {
    // Empty values in .env (for example S3_ENDPOINT=) are treated as unset.
    const cleaned = Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== ""),
    );
    return envSchema.parse(cleaned);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid environment configuration -> ${issues}`);
    }
    throw error;
  }
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
