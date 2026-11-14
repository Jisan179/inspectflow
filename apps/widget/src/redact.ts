export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Normalises two corner points into a rectangle with positive size. */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Pixelation block size for a region: big enough that text is unreadable. */
export function blockSizeFor(rect: Rect) {
  return Math.max(12, Math.round(Math.min(rect.width, rect.height) / 3));
}

/**
 * Irreversible redaction. Replaces the region with large solid blocks, each
 * the average colour of the pixels it covered. Averaging is many-to-one, so
 * the original pixels cannot be recovered from the result, and the function
 * overwrites the pixel data in place so no unredacted copy of the region
 * remains in the image that gets uploaded.
 *
 * `data` is RGBA (4 bytes per pixel), as in canvas ImageData.
 */
export function pixelate(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect,
  block = blockSizeFor(rect),
) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));

  for (let by = y0; by < y1; by += block) {
    for (let bx = x0; bx < x1; bx += block) {
      const ex = Math.min(bx + block, x1);
      const ey = Math.min(by + block, y1);
      let r = 0, g = 0, b = 0, a = 0, n = 0;

      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const i = (y * width + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
          n++;
        }
      }
      if (n === 0) continue;
      const [ar, ag, ab, aa] = [r / n, g / n, b / n, a / n].map(Math.round);

      for (let y = by; y < ey; y++) {
        for (let x = bx; x < ex; x++) {
          const i = (y * width + x) * 4;
          data[i] = ar; data[i + 1] = ag; data[i + 2] = ab; data[i + 3] = aa;
        }
      }
    }
  }
}

/** Applies pixelate() to every blur rectangle of a canvas, in place. */
export function redactCanvas(canvas: HTMLCanvasElement, rects: Rect[]) {
  if (rects.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (const rect of rects) pixelate(image.data, canvas.width, canvas.height, rect);
  ctx.putImageData(image, 0, 0);
}
