import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac } from "crypto";
import { promises as fs } from "fs";
import { dirname, join, resolve, sep } from "path";
import { env } from "@/config";
import { safeEqual } from "@/common/utils/crypto";

/**
 * Private object storage for screenshots.
 *
 * - "s3" driver: any S3-compatible bucket (Cloudflare R2, Supabase, MinIO).
 *   The bucket stays private; clients only get short-lived signed URLs.
 * - "local" driver: files on disk for development and tests. It mimics signed
 *   URLs with an HMAC so the same code path (expiring links) is exercised.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = resolve(process.cwd(), "uploads");
  private s3?: S3Client;

  constructor() {
    if (env.STORAGE_DRIVER === "s3") {
      this.s3 = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
        },
      });
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return;
    }
    const path = this.localPath(key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, body);
  }

  async delete(key: string) {
    try {
      if (this.s3) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
        );
      } else {
        await fs.rm(this.localPath(key), { force: true });
      }
    } catch (error) {
      // Deletion is best effort: the database row is the source of truth.
      this.logger.warn(`Could not delete ${key}: ${(error as Error).message}`);
    }
  }

  /** Short-lived URL the browser can use to display a private object. */
  async signedUrl(key: string, ttlSeconds = env.SIGNED_URL_TTL_SECONDS) {
    if (this.s3) {
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
        { expiresIn: ttlSeconds },
      );
    }
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(key, exp);
    const params = new URLSearchParams({ key, exp: String(exp), sig });
    return `${env.PUBLIC_API_URL}/files/local?${params.toString()}`;
  }

  /** Verifies a local signed URL and returns the file bytes. */
  async readLocal(key: string, exp: number, sig: string) {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) {
      throw new NotFoundException("Link expired");
    }
    if (!safeEqual(this.sign(key, exp), sig)) {
      throw new NotFoundException("Invalid link");
    }
    try {
      return await fs.readFile(this.localPath(key));
    } catch {
      throw new NotFoundException("File not found");
    }
  }

  private sign(key: string, exp: number) {
    return createHmac("sha256", env.JWT_ACCESS_SECRET)
      .update(`${key}:${exp}`)
      .digest("hex");
  }

  /** Resolves a key inside the uploads folder and blocks path traversal. */
  private localPath(key: string) {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) {
      throw new NotFoundException("Invalid key");
    }
    return full;
  }

  /** Test helper: where local files live. */
  get localRoot() {
    return join(this.root);
  }
}
