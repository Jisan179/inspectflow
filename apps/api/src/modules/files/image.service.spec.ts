import sharp from "sharp";
import { ImageService, MAX_SCREENSHOT_BYTES, detectImageType } from "./image.service";

const png = (w = 50, h = 30) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#cc3333" } })
    .png()
    .toBuffer();

describe("ImageService", () => {
  const service = new ImageService();

  it("detects types from magic bytes", async () => {
    expect(detectImageType(await png())).toBe("image/png");
    const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    expect(detectImageType(jpg)).toBe("image/jpeg");
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).webp().toBuffer();
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(Buffer.from("not an image at all"))).toBeNull();
  });

  it("accepts a valid PNG and returns a re-encoded PNG", async () => {
    const out = await service.validateAndProcess(await png(), "image/png");
    expect(out.mimeType).toBe("image/png");
    expect(detectImageType(out.buffer)).toBe("image/png");
    expect(out.width).toBe(50);
  });

  it("rejects a missing file", async () => {
    await expect(service.validateAndProcess(undefined, "image/png")).rejects.toThrow(
      /required/,
    );
  });

  it("rejects a disallowed declared MIME type", async () => {
    await expect(service.validateAndProcess(await png(), "application/pdf")).rejects.toThrow(
      /must be image/,
    );
  });

  it("rejects text renamed to .png (magic bytes mismatch)", async () => {
    await expect(
      service.validateAndProcess(Buffer.from("<script>alert(1)</script>"), "image/png"),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects a JPEG that claims to be PNG", async () => {
    const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    await expect(service.validateAndProcess(jpg, "image/png")).rejects.toThrow(/does not match/);
  });

  it("rejects files over the size limit", async () => {
    const big = Buffer.alloc(MAX_SCREENSHOT_BYTES + 1, 1);
    await expect(service.validateAndProcess(big, "image/png")).rejects.toThrow(/5 MB/);
  });

  it("rejects a corrupt image with valid-looking header", async () => {
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6]);
    await expect(service.validateAndProcess(header, "image/png")).rejects.toThrow(
      /could not be processed/,
    );
  });
});
