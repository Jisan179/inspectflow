import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import sharp from "sharp";

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

/** Detects the real image type from the first bytes (the "magic bytes"). */
export function detectImageType(buf: Buffer): string | null {
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: "image/png";
  sizeBytes: number;
  width: number;
  height: number;
}

@Injectable()
export class ImageService {
  /**
   * Validates an uploaded screenshot (size, declared MIME type, magic bytes)
   * and re-encodes it as PNG. Re-encoding strips metadata and removes any
   * payload hidden in a file that merely looks like an image.
   */
  async validateAndProcess(
    buffer: Buffer | undefined,
    declaredMime?: string,
  ): Promise<ProcessedImage> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException("A screenshot file is required");
    }
    if (buffer.length > MAX_SCREENSHOT_BYTES) {
      throw new PayloadTooLargeException("Screenshot exceeds the 5 MB limit");
    }
    if (!declaredMime || !ALLOWED_MIME.includes(declaredMime)) {
      throw new UnsupportedMediaTypeException(
        "Screenshot must be image/png, image/jpeg or image/webp",
      );
    }
    const detected = detectImageType(buffer);
    if (!detected || detected !== declaredMime) {
      throw new UnsupportedMediaTypeException(
        "File content does not match a supported image type",
      );
    }
    try {
      const { data, info } = await sharp(buffer, { limitInputPixels: 50_000_000 })
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer({ resolveWithObject: true });
      return {
        buffer: data,
        mimeType: "image/png",
        sizeBytes: data.length,
        width: info.width,
        height: info.height,
      };
    } catch {
      throw new BadRequestException("Screenshot could not be processed");
    }
  }
}
