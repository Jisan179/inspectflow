import Konva from "konva";
import { Rect, rectFromPoints, redactCanvas } from "./redact";

export type Tool = "ARROW" | "BOX" | "BLUR";

/** One annotation in IMAGE coordinates (pixels of the captured screenshot). */
export interface Shape {
  id: string;
  type: Tool;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const RED = "#e5484d";
const BLUE = "#3b6cf6";
const MIN_SIZE = 6;

let counter = 0;
const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;
const clone = (shapes: Shape[]) => shapes.map((s) => ({ ...s }));

/**
 * Screenshot annotation editor.
 *
 * Konva handles the interaction (drawing, preview). The final image is NOT
 * taken from Konva: export() redraws the screenshot with Canvas 2D, applies
 * irreversible pixelation to every blur region, then draws arrows and boxes on
 * top. Only that flattened PNG is ever uploaded, so a blurred area leaves the
 * browser already destroyed.
 */
export class AnnotationEditor {
  tool: Tool = "ARROW";
  onChange: () => void = () => {};

  private readonly stage: Konva.Stage;
  private readonly bgLayer = new Konva.Layer();
  private readonly shapeLayer = new Konva.Layer();
  private readonly bgImage: Konva.Image;
  private readonly preview: HTMLCanvasElement;
  private readonly scale: number;

  private shapes: Shape[] = [];
  private past: Shape[][] = [];
  private future: Shape[][] = [];
  private draft: Shape | null = null;

  constructor(
    container: HTMLElement,
    private readonly original: HTMLCanvasElement,
    maxWidth: number,
    maxHeight: number,
  ) {
    const w = original.width;
    const h = original.height;
    this.scale = Math.min(1, maxWidth / w, maxHeight / h);

    this.preview = document.createElement("canvas");
    this.preview.width = w;
    this.preview.height = h;

    this.stage = new Konva.Stage({
      container: container as HTMLDivElement,
      width: Math.round(w * this.scale),
      height: Math.round(h * this.scale),
      scale: { x: this.scale, y: this.scale },
    });
    this.bgImage = new Konva.Image({ image: this.preview, width: w, height: h });
    this.bgLayer.add(this.bgImage);
    this.stage.add(this.bgLayer, this.shapeLayer);

    this.updatePreview();
    this.attachPointerEvents();
  }

  // ---- public API ------------------------------------------------------

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  get annotations(): Shape[] {
    return clone(this.shapes);
  }

  setTool(tool: Tool) {
    this.tool = tool;
  }

  undo() {
    if (!this.canUndo) return;
    this.future.push(clone(this.shapes));
    this.shapes = this.past.pop()!;
    this.refresh();
  }

  redo() {
    if (!this.canRedo) return;
    this.past.push(clone(this.shapes));
    this.shapes = this.future.pop()!;
    this.refresh();
  }

  /** Produces the final, flattened and redacted PNG. */
  async export(): Promise<Blob> {
    const out = document.createElement("canvas");
    out.width = this.original.width;
    out.height = this.original.height;
    const ctx = out.getContext("2d")!;

    // 1. Start from the original, then destroy every blurred region.
    ctx.drawImage(this.original, 0, 0);
    redactCanvas(out, this.blurRects());

    // 2. Draw arrows and boxes over the redacted image.
    for (const s of this.shapes) {
      if (s.type === "BOX") drawBox(ctx, s);
      if (s.type === "ARROW") drawArrow(ctx, s);
    }

    return new Promise((resolve, reject) =>
      out.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))),
        "image/png",
      ),
    );
  }

  destroy() {
    this.stage.destroy();
  }

  get imageSize() {
    return { width: this.original.width, height: this.original.height };
  }

  // ---- drawing ---------------------------------------------------------

  private attachPointerEvents() {
    const pos = () => {
      const p = this.stage.getPointerPosition();
      return p ? { x: p.x / this.scale, y: p.y / this.scale } : null;
    };

    this.stage.on("mousedown touchstart", () => {
      const p = pos();
      if (!p) return;
      this.draft = { id: newId(), type: this.tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    });

    this.stage.on("mousemove touchmove", () => {
      const p = pos();
      if (!this.draft || !p) return;
      this.draft.x2 = clamp(p.x, 0, this.original.width);
      this.draft.y2 = clamp(p.y, 0, this.original.height);
      this.renderShapes();
    });

    const finish = () => {
      const d = this.draft;
      this.draft = null;
      if (!d) return;
      const big = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= MIN_SIZE;
      if (big) {
        this.past.push(clone(this.shapes));
        this.future = [];
        this.shapes.push(d);
        this.refresh();
      } else {
        this.renderShapes();
      }
    };
    this.stage.on("mouseup touchend mouseleave", finish);
  }

  private refresh() {
    this.updatePreview();
    this.renderShapes();
    this.onChange();
  }

  private blurRects(): Rect[] {
    return this.shapes
      .filter((s) => s.type === "BLUR")
      .map((s) => rectFromPoints(s.x1, s.y1, s.x2, s.y2));
  }

  /** The screenshot shown in the editor already has blur applied. */
  private updatePreview() {
    const ctx = this.preview.getContext("2d")!;
    ctx.clearRect(0, 0, this.preview.width, this.preview.height);
    ctx.drawImage(this.original, 0, 0);
    redactCanvas(this.preview, this.blurRects());
    this.bgImage.image(this.preview);
    this.bgLayer.batchDraw();
  }

  private renderShapes() {
    this.shapeLayer.destroyChildren();
    const all = this.draft ? [...this.shapes, this.draft] : this.shapes;
    for (const s of all) {
      if (s.type === "ARROW") {
        this.shapeLayer.add(
          new Konva.Arrow({
            points: [s.x1, s.y1, s.x2, s.y2],
            stroke: RED,
            fill: RED,
            strokeWidth: 4,
            pointerLength: 16,
            pointerWidth: 16,
            lineCap: "round",
          }),
        );
      } else {
        const r = rectFromPoints(s.x1, s.y1, s.x2, s.y2);
        this.shapeLayer.add(
          new Konva.Rect({
            ...r,
            stroke: s.type === "BOX" ? RED : BLUE,
            strokeWidth: s.type === "BOX" ? 4 : 2,
            dash: s.type === "BLUR" ? [8, 6] : undefined,
          }),
        );
      }
    }
    this.shapeLayer.batchDraw();
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function drawBox(ctx: CanvasRenderingContext2D, s: Shape) {
  const r = rectFromPoints(s.x1, s.y1, s.x2, s.y2);
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.lineWidth = 4;
  ctx.strokeRect(r.x, r.y, r.width, r.height);
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, s: Shape) {
  const head = 16;
  const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  ctx.lineTo(s.x2, s.y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s.x2, s.y2);
  ctx.lineTo(s.x2 - head * Math.cos(angle - Math.PI / 6), s.y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(s.x2 - head * Math.cos(angle + Math.PI / 6), s.y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
