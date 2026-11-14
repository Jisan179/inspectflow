import { blockSizeFor, pixelate, rectFromPoints } from "../src/redact";

/** Deterministic pseudo-random RGBA image: every pixel differs, like text on a page. */
function noisyImage(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  let a = 0x9e3779b9; // mulberry32: small, well-distributed PRNG
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) % 256);
  };
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rnd(); data[i + 1] = rnd(); data[i + 2] = rnd(); data[i + 3] = 255;
  }
  return data;
}

const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => {
  const i = (y * w + x) * 4;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]].join(",");
};

describe("irreversible blur (pixelate)", () => {
  const W = 120, H = 80;
  const rect = { x: 20, y: 10, width: 60, height: 40 };

  it("leaves pixels outside the region untouched", () => {
    const original = noisyImage(W, H);
    const data = new Uint8ClampedArray(original);
    pixelate(data, W, H, rect);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inside = x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
        if (!inside) expect(px(data, W, x, y)).toBe(px(original, W, x, y));
      }
    }
  });

  it("destroys the original pixels inside the region", () => {
    const original = noisyImage(W, H);
    const data = new Uint8ClampedArray(original);
    pixelate(data, W, H, rect);

    let same = 0, total = 0;
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        total++;
        if (px(data, W, x, y) === px(original, W, x, y)) same++;
      }
    }
    // With random source pixels, an averaged block can only coincide by chance.
    expect(same / total).toBeLessThan(0.02);
  });

  it("replaces the region with uniform blocks (information is discarded)", () => {
    const data = noisyImage(W, H);
    pixelate(data, W, H, rect);
    const block = blockSizeFor(rect);

    const colours = new Set<string>();
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) colours.add(px(data, W, x, y));
    }
    const blocks = Math.ceil(rect.width / block) * Math.ceil(rect.height / block);
    expect(colours.size).toBeLessThanOrEqual(blocks);
    expect(colours.size).toBeLessThan(rect.width * rect.height / 20);
  });

  it("is not reversible: two different images with equal block averages give identical output", () => {
    // Many-to-one: swapping pixels inside a block must not change the result.
    const a = noisyImage(W, H);
    const b = new Uint8ClampedArray(a);
    // swap two pixels inside the first block of the region
    const i1 = (rect.y * W + rect.x) * 4;
    const i2 = ((rect.y + 1) * W + rect.x + 1) * 4;
    for (let k = 0; k < 4; k++) [b[i1 + k], b[i2 + k]] = [b[i2 + k], b[i1 + k]];
    expect(Array.from(a)).not.toEqual(Array.from(b));
    pixelate(a, W, H, rect);
    pixelate(b, W, H, rect);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("clamps regions that extend past the image", () => {
    const data = noisyImage(W, H);
    expect(() => pixelate(data, W, H, { x: -20, y: -20, width: 400, height: 400 })).not.toThrow();
    // whole image is now blocky: far fewer colours than pixels
    const colours = new Set<string>();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) colours.add(px(data, W, x, y));
    expect(colours.size).toBeLessThan(W * H / 20);
  });

  it("normalises rectangles drawn in any direction", () => {
    expect(rectFromPoints(50, 40, 10, 5)).toEqual({ x: 10, y: 5, width: 40, height: 35 });
  });

  it("uses blocks large enough to hide text", () => {
    expect(blockSizeFor({ x: 0, y: 0, width: 40, height: 20 })).toBeGreaterThanOrEqual(12);
  });
});
