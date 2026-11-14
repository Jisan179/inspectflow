import { ApiClient, ApiError, ReportPayload, WidgetConfig } from "./api";
import { captureViewport } from "./capture";
import { Collector } from "./collector";
import { AnnotationEditor, Tool } from "./editor";
import { STYLES } from "./styles";

type Child = Node | string | null | undefined | false;

/** Tiny DOM helper. All text goes through textContent, so nothing is injected as HTML. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: any) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") node.addEventListener(key.replace(/^on/, ""), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false) node.setAttribute(key, String(value));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export interface UiOptions {
  api: ApiClient;
  collector: Collector;
  projectKey: string;
  buildId?: string;
  position: "right" | "left";
}

/**
 * The visible part of the widget: launcher button, sign-in, annotation screen
 * and result messages. It lives in a Shadow DOM so the host page's CSS cannot
 * break it and it cannot break the host page.
 */
export class WidgetUi {
  private readonly host = document.createElement("div");
  private readonly root: ShadowRoot;
  private launcher!: HTMLButtonElement;
  private layer: HTMLElement | null = null;
  private editor: AnnotationEditor | null = null;
  private config: WidgetConfig | null = null;
  private busy = false;

  constructor(private readonly o: UiOptions) {
    this.host.id = "inspectflow-root";
    this.root = this.host.attachShadow({ mode: "open" });
  }

  mount() {
    this.root.append(el("style", {}, STYLES));
    this.launcher = el(
      "button",
      {
        class: `launcher ${this.o.position}`,
        "aria-label": "Report an issue with this page",
        onclick: () => void this.start(),
      },
      el("span", { class: "dot", "aria-hidden": "true" }),
      "Report issue",
    );
    this.root.append(this.launcher);
    document.body.append(this.host);
  }

  /** Opens the report flow (also reachable as window.InspectFlow.open()). */
  async start() {
    if (this.busy || this.layer) return;
    this.busy = true;
    try {
      this.config ??= await this.o.api.getConfig();
      const token = this.token();
      if (!token) {
        this.showLogin();
        return;
      }
      await this.captureAndEdit(token);
    } catch (e) {
      this.showMessage("Something went wrong", errText(e), true);
    } finally {
      this.busy = false;
    }
  }

  // ---- token (kept in sessionStorage so it ends with the tab) ----------

  private storageKey() {
    return `inspectflow:token:${this.o.projectKey}`;
  }
  private token(): string | null {
    try {
      return sessionStorage.getItem(this.storageKey());
    } catch {
      return null;
    }
  }
  private setToken(token: string | null) {
    try {
      if (token) sessionStorage.setItem(this.storageKey(), token);
      else sessionStorage.removeItem(this.storageKey());
    } catch {
      /* storage blocked: user just signs in again next time */
    }
  }

  // ---- screens ----------------------------------------------------------

  private open(content: HTMLElement, wide = false) {
    this.close();
    const layer = el(
      "div",
      { class: "backdrop", role: "dialog", "aria-modal": "true", onkeydown: (e: KeyboardEvent) => e.key === "Escape" && this.close() },
      el("div", { class: wide ? "card wide" : "card" }, content),
    );
    this.layer = layer;
    this.root.append(layer);
    this.launcher.style.display = "none";
    return layer;
  }

  private close() {
    this.editor?.destroy();
    this.editor = null;
    this.layer?.remove();
    this.layer = null;
    this.launcher.style.display = "";
  }

  private showMessage(title: string, text: string, isError = false) {
    this.open(
      el(
        "div",
        { class: "stack" },
        el("h2", {}, title),
        el("p", { class: isError ? "error" : "muted", role: isError ? "alert" : "status" }, text),
        el("div", { class: "row end" }, el("button", { class: "btn primary", onclick: () => this.close() }, "Close")),
      ),
    );
  }

  private showLogin(error = "") {
    const email = el("input", { type: "email", id: "if-email", autocomplete: "username", required: true });
    const password = el("input", { type: "password", id: "if-password", autocomplete: "current-password", required: true });
    const errorBox = el("p", { class: "error", role: "alert" }, error);
    const submit = el("button", { class: "btn primary", type: "submit" }, "Sign in and continue");

    const form = el(
      "form",
      {
        class: "stack",
        onsubmit: async (e: Event) => {
          e.preventDefault();
          submit.disabled = true;
          errorBox.textContent = "";
          try {
            const res = await this.o.api.login(email.value, password.value);
            this.setToken(res.accessToken);
            this.close();
            this.busy = true;
            await this.captureAndEdit(res.accessToken);
          } catch (err) {
            submit.disabled = false;
            errorBox.textContent = errText(err);
          } finally {
            this.busy = false;
          }
        },
      },
      el("h2", {}, "Sign in to report an issue"),
      el("p", { class: "muted" }, `Project: ${this.config?.projectName ?? ""}. Use your InspectFlow account.`),
      el("label", { for: "if-email" }, "Email"),
      email,
      el("label", { for: "if-password" }, "Password"),
      password,
      errorBox,
      el("div", { class: "row end" }, el("button", { class: "btn", type: "button", onclick: () => this.close() }, "Cancel"), submit),
    );
    this.open(form);
    email.focus();
  }

  private async captureAndEdit(token: string) {
    // Hide the widget so it does not appear in its own screenshot.
    this.launcher.style.display = "none";
    this.host.style.display = "none";
    let canvas: HTMLCanvasElement;
    try {
      await new Promise((r) => setTimeout(r, 60)); // let the browser repaint
      canvas = await captureViewport([this.host]);
    } finally {
      this.host.style.display = "";
      this.launcher.style.display = "";
    }
    this.showEditor(canvas, token);
  }

  private showEditor(canvas: HTMLCanvasElement, token: string) {
    const canvasHost = el("div", { class: "canvas-host", "aria-label": "Screenshot annotation area" });
    const toolButtons = new Map<Tool, HTMLButtonElement>();
    const undoBtn = el("button", { class: "btn", "aria-label": "Undo", onclick: () => this.editor?.undo() }, "Undo");
    const redoBtn = el("button", { class: "btn", "aria-label": "Redo", onclick: () => this.editor?.redo() }, "Redo");

    const syncButtons = () => {
      undoBtn.disabled = !this.editor?.canUndo;
      redoBtn.disabled = !this.editor?.canRedo;
      toolButtons.forEach((b, t) => b.classList.toggle("active", this.editor?.tool === t));
    };
    const toolButton = (tool: Tool, label: string, hint: string) => {
      const b = el("button", { class: "btn tool", title: hint, "aria-label": hint, onclick: () => { this.editor?.setTool(tool); syncButtons(); } }, label);
      toolButtons.set(tool, b);
      return b;
    };

    const description = el("textarea", { id: "if-desc", rows: "5", maxlength: "5000", placeholder: "What went wrong? What did you expect?", required: true });
    const severity = el(
      "select",
      { id: "if-sev" },
      ...(["LOW", "MEDIUM", "HIGH", "BLOCKER"] as const).map((s) =>
        el("option", { value: s, selected: s === "MEDIUM" }, s === "BLOCKER" ? "Blocker (page unusable)" : s[0] + s.slice(1).toLowerCase()),
      ),
    );
    const errorBox = el("p", { class: "error", role: "alert" });
    const submit = el("button", { class: "btn primary", type: "submit" }, "Send report");

    const counts = this.o.collector.counts();
    const info = el(
      "details",
      { class: "info", open: true },
      el("summary", {}, "What will be sent with this report"),
      el(
        "ul",
        {},
        ...(this.config?.captures ?? []).map((c) => el("li", {}, c)),
        el("li", { class: "strong" }, `Right now: ${counts.errors} console error(s), ${counts.failedRequests} failed request(s).`),
      ),
      el("p", { class: "muted small" }, "Passwords, cookies, tokens and request contents are never captured."),
    );

    const form = el(
      "form",
      {
        class: "side stack",
        onsubmit: async (e: Event) => {
          e.preventDefault();
          if (!this.editor) return;
          submit.disabled = true;
          submit.textContent = "Sending...";
          errorBox.textContent = "";
          try {
            const blob = await this.editor.export();
            const size = this.editor.imageSize;
            const payload: ReportPayload = {
              description: description.value.trim(),
              severity: severity.value as ReportPayload["severity"],
              pageUrl: location.href,
              viewport: `${window.innerWidth}x${window.innerHeight}`,
              userAgent: navigator.userAgent,
              buildId: this.o.buildId,
              events: this.o.collector.snapshot(),
              annotations: this.editor.annotations.map((s) => ({
                type: s.type,
                shapeJson: { x1: round(s.x1), y1: round(s.y1), x2: round(s.x2), y2: round(s.y2), imageWidth: size.width, imageHeight: size.height },
              })),
            };
            const res = await this.o.api.submit(token, payload, blob);
            this.showMessage("Report sent", `Thank you! Ticket IF-${res.number} was created and the team can see your screenshot and technical details.`);
          } catch (err) {
            submit.disabled = false;
            submit.textContent = "Send report";
            if (err instanceof ApiError && err.status === 401) {
              this.setToken(null);
              errorBox.textContent = "Your session expired. Close this window and click Report issue to sign in again.";
            } else {
              errorBox.textContent = errText(err);
            }
          }
        },
      },
      el("label", { for: "if-desc" }, "Describe the problem"),
      description,
      el("label", { for: "if-sev" }, "How serious is it?"),
      severity,
      info,
      errorBox,
      el("div", { class: "row end" }, el("button", { class: "btn", type: "button", onclick: () => this.close() }, "Cancel"), submit),
    );

    const toolbar = el(
      "div",
      { class: "toolbar", role: "toolbar", "aria-label": "Annotation tools" },
      el("strong", {}, "Annotate"),
      toolButton("ARROW", "Arrow", "Draw an arrow"),
      toolButton("BOX", "Box", "Draw a box"),
      toolButton("BLUR", "Blur", "Blur sensitive information"),
      undoBtn,
      redoBtn,
      el("span", { class: "muted small hint" }, "Drag on the screenshot. Blurred areas are destroyed before upload."),
    );

    this.open(el("div", { class: "editor" }, toolbar, el("div", { class: "editor-body" }, canvasHost, form)), true);

    const maxW = Math.min(window.innerWidth - 40, window.innerWidth > 900 ? window.innerWidth - 380 : window.innerWidth - 40);
    const maxH = window.innerHeight - 140;
    this.editor = new AnnotationEditor(canvasHost, canvas, Math.max(maxW, 280), Math.max(maxH, 200));
    this.editor.onChange = syncButtons;
    syncButtons();
    description.focus();
  }
}

const round = (n: number) => Math.round(n);
const errText = (e: unknown) => (e instanceof Error ? e.message : "Unexpected error");
