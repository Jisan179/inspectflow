/** Widget styles, injected into the Shadow DOM so they never leak to the page. */
export const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.launcher {
  position: fixed; bottom: 20px; z-index: 2147483000; display: flex; align-items: center; gap: 8px;
  background: #1f2a44; color: #fff; border: 0; border-radius: 999px; padding: 12px 18px;
  font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 6px 20px rgba(15,23,42,.35);
}
.launcher.right { right: 20px; } .launcher.left { left: 20px; }
.launcher:hover { background: #2c3b5e; } .launcher:focus-visible, .btn:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 3px solid #7aa2ff; outline-offset: 2px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #ff6369; }
.backdrop { position: fixed; inset: 0; z-index: 2147483001; background: rgba(15,23,42,.72); display: flex; align-items: center; justify-content: center; padding: 16px; }
.card { background: #fff; color: #1b2438; border-radius: 14px; padding: 22px; width: 100%; max-width: 420px; max-height: 94vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
.card.wide { max-width: none; width: 100%; height: 100%; max-height: none; padding: 0; display: flex; }
.stack { display: flex; flex-direction: column; gap: 10px; }
h2 { margin: 0; font-size: 20px; }
label { font-size: 13px; font-weight: 600; margin-top: 4px; }
input, textarea, select { width: 100%; border: 1px solid #c6cddd; border-radius: 8px; padding: 10px; font-size: 14px; background: #fff; color: #1b2438; }
textarea { resize: vertical; }
.row { display: flex; gap: 8px; } .row.end { justify-content: flex-end; margin-top: 6px; }
.btn { border: 1px solid #c6cddd; background: #fff; color: #1b2438; border-radius: 8px; padding: 8px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover:not(:disabled) { background: #eef1f8; } .btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.primary { background: #3b6cf6; border-color: #3b6cf6; color: #fff; } .btn.primary:hover:not(:disabled) { background: #2f58d1; }
.btn.tool.active { background: #1f2a44; color: #fff; border-color: #1f2a44; }
.error { color: #c0262d; font-size: 13px; margin: 0; min-height: 0; } .muted { color: #5b6784; margin: 0; } .small { font-size: 12px; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #e2e6f0; background: #f6f8fc; border-radius: 14px 14px 0 0; }
.hint { margin-left: auto; }
.editor-body { flex: 1; display: flex; min-height: 0; }
.canvas-host { flex: 1; overflow: auto; background: #dfe4ef; display: flex; align-items: flex-start; justify-content: center; padding: 14px; cursor: crosshair; }
.canvas-host .konvajs-content { box-shadow: 0 2px 12px rgba(0,0,0,.25); }
.side { width: 340px; padding: 16px; overflow: auto; border-left: 1px solid #e2e6f0; }
.info { background: #f2f5fc; border: 1px solid #dbe2f2; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
.info summary { cursor: pointer; font-weight: 600; } .info ul { margin: 8px 0 6px 18px; padding: 0; } .info li { margin: 3px 0; } .strong { font-weight: 600; }
@media (max-width: 860px) { .editor-body { flex-direction: column; } .side { width: 100%; border-left: 0; border-top: 1px solid #e2e6f0; max-height: 46vh; } .hint { display: none; } }
@media (prefers-color-scheme: dark) {
  .card, .btn, input, textarea, select { background: #182033; color: #e6ebf7; border-color: #34405e; }
  .toolbar { background: #1d2740; border-color: #34405e; } .side { border-color: #34405e; } .info { background: #1d2740; border-color: #34405e; }
  .btn:hover:not(:disabled) { background: #26324f; } .muted { color: #9aa7c7; }
}
`;
