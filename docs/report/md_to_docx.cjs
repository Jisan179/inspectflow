// Converts a simple Markdown file (headings, lists, tables, code fences) to Word.
// usage: node md_to_docx.cjs <input.md> <output.docx> "<title>"
const fs = require("fs"), path = require("path");
const d = require(path.join(__dirname, "tools/node_modules/docx"));
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, HeadingLevel, AlignmentType, LevelFormat, Footer, PageNumber } = d;
const [inp, out, title] = process.argv.slice(2);
const FONT = "Nirmala UI", MONO = "Consolas", INK = "1F2A44", W = 9638;
const lines = fs.readFileSync(inp, "utf8").replace(/\r/g, "").split("\n");

function runs(text, base = {}) {
  const out = [], re = /(\*\*[^*]+\*\*|`[^`]+`)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size: 22, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), font: FONT, size: 22, bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: MONO, size: 20, shading: { type: ShadingType.CLEAR, fill: "EEF1F8" } }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, size: 22, ...base }));
  return out;
}
const bd = { style: BorderStyle.SINGLE, size: 4, color: "B9C2D6" }, borders = { top: bd, bottom: bd, left: bd, right: bd };
let firstPart = true;
const H = (lvl, text) => {
  text = text.replace(/`/g, "");
  const brk = lvl === 2 && /^ভাগ/.test(text) && !firstPart;
  if (lvl === 2 && /^ভাগ/.test(text)) firstPart = false;
  return new Paragraph({ heading: [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][lvl], children: [new TextRun({ text, font: FONT })], pageBreakBefore: brk });
};
// Consolas has no Bengali glyphs: render Bengali characters in Nirmala UI inside code blocks.
function codeRuns(line) {
  const out = []; const re = /([ঀ-৿]+(?:[ ,.()ঀ-৿]*[ঀ-৿])?)/g; let last = 0, m;
  const line2 = line || " ";
  while ((m = re.exec(line2))) {
    if (m.index > last) out.push(new TextRun({ text: line2.slice(last, m.index), font: MONO, size: 17 }));
    out.push(new TextRun({ text: m[0], font: FONT, size: 17 }));
    last = m.index + m[0].length;
  }
  if (last < line2.length) out.push(new TextRun({ text: line2.slice(last), font: MONO, size: 17 }));
  return out;
}

function codeBlock(arr) {
  const cb = { style: BorderStyle.SINGLE, size: 4, color: "B9C2D6" };
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [new TableRow({ children: [new TableCell({
    borders: { top: cb, bottom: cb, right: cb, left: { style: BorderStyle.SINGLE, size: 18, color: "3B6CF6" } },
    width: { size: W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "F4F6FB" }, margins: { top: 80, bottom: 80, left: 140, right: 100 },
    children: arr.map((l) => new Paragraph({ spacing: { after: 0, line: 240 }, children: codeRuns(l) })),
  })] })] });
}
function tbl(rows) {
  const cells = rows.map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  const head = cells[0], body = cells.slice(2), n = head.length, w = Math.floor(W / n);
  const widths = Array.from({ length: n }, (_, i) => (i === n - 1 ? W - w * (n - 1) : w));
  const mk = (t, i, h, z) => new TableCell({ borders, width: { size: widths[i], type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: h ? { type: ShadingType.CLEAR, fill: INK } : z ? { type: ShadingType.CLEAR, fill: "F5F7FC" } : undefined,
    children: [new Paragraph({ spacing: { after: 20 }, children: runs(t, h ? { bold: true, color: "FFFFFF", size: 20 } : { size: 20 }) })] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: [
    new TableRow({ tableHeader: true, cantSplit: true, children: head.map((t, i) => mk(t, i, true)) }),
    ...body.map((r, ri) => new TableRow({ cantSplit: true, children: Array.from({ length: n }, (_, i) => mk(r[i] ?? "", i, false, ri % 2)) })),
  ] });
}

const kids = []; let i = 0, numRef = 0;
while (i < lines.length) {
  const l = lines[i];
  if (l.startsWith("```")) { const buf = []; i++; while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]); i++; kids.push(codeBlock(buf), new Paragraph({ spacing: { after: 100 }, children: [] })); continue; }
  if (l.startsWith("|")) { const buf = []; while (i < lines.length && lines[i].startsWith("|")) buf.push(lines[i++]); kids.push(tbl(buf), new Paragraph({ spacing: { after: 100 }, children: [] })); continue; }
  let m;
  if ((m = l.match(/^(#{1,3}) (.*)/))) { kids.push(H(m[1].length, m[2])); i++; continue; }
  if (/^---+$/.test(l.trim())) { i++; continue; }
  if ((m = l.match(/^[-*] (.*)/))) { kids.push(new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 60, line: 300 }, children: runs(m[1]) })); i++; continue; }
  if ((m = l.match(/^(\d+)\. (.*)/))) { if (!(lines[i - 1] || "").match(/^\d+\. /)) numRef++; kids.push(new Paragraph({ numbering: { reference: "n" + numRef, level: 0 }, spacing: { after: 60, line: 300 }, children: runs(m[2]) })); i++; continue; }
  if (l.trim() === "") { i++; continue; }
  kids.push(new Paragraph({ spacing: { after: 120, line: 300 }, children: runs(l) })); i++;
}
const numCfg = [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
  ...Array.from({ length: numRef }, (_, k) => ({ reference: "n" + (k + 1), levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }))];
const doc = new Document({
  title, creator: "InspectFlow", numbering: { config: numCfg },
  styles: { default: { document: { run: { font: FONT, size: 22 } } }, paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 38, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 200 }, keepNext: true, outlineLevel: 0 } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: "2C55D1" }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
    { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 25, bold: true, color: INK }, paragraph: { spacing: { before: 200, after: 90 }, keepNext: true, outlineLevel: 2 } } ] },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "InspectFlow Study Guide | page ", font: FONT, size: 16, color: "6B7791" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "6B7791" })] })] }) },
    children: kids }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(out, b); console.log("wrote", out, Math.round(b.length / 1024), "KB"); });
