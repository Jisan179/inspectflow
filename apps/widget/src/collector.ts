import { RingBuffer } from "./ring-buffer";
import { sanitizeText, sanitizeUrl } from "./sanitize";

export interface CapturedEvent {
  type: "CONSOLE" | "NETWORK" | "ERROR";
  method?: string;
  url?: string;
  statusCode?: number;
  durationMs?: number;
  message?: string;
  stack?: string;
  timestamp: string;
}

export interface CollectorOptions {
  /** Max events kept (rolling). */
  capacity?: number;
  /** Requests to these URL prefixes are not recorded (the InspectFlow API). */
  ignoreUrlPrefixes?: string[];
}

/**
 * Background collector. It listens for console errors, uncaught exceptions,
 * unhandled promise rejections, failed resource loads and failed fetch / XHR
 * calls, and keeps the most recent ones in a bounded rolling buffer.
 *
 * What it deliberately does NOT record: request or response headers, request or
 * response bodies, cookies, and local/session storage. Only method, URL (with
 * sensitive query values removed), status code and duration are kept.
 */
export class Collector {
  private readonly buffer: RingBuffer<CapturedEvent>;
  private readonly ignore: string[];
  private restore: Array<() => void> = [];

  constructor(options: CollectorOptions = {}) {
    this.buffer = new RingBuffer(options.capacity ?? 100);
    this.ignore = options.ignoreUrlPrefixes ?? [];
  }

  install(win: Window & typeof globalThis = window) {
    this.patchConsole(win);
    this.listenForErrors(win);
    this.patchFetch(win);
    this.patchXhr(win);
  }

  uninstall() {
    this.restore.forEach((fn) => fn());
    this.restore = [];
  }

  /** Current buffer contents, oldest first. */
  snapshot(): CapturedEvent[] {
    return this.buffer.toArray();
  }

  counts() {
    const events = this.buffer.toArray();
    return {
      errors: events.filter((e) => e.type === "CONSOLE" || e.type === "ERROR").length,
      failedRequests: events.filter((e) => e.type === "NETWORK").length,
    };
  }

  private record(event: Omit<CapturedEvent, "timestamp">) {
    this.buffer.push({ ...event, timestamp: new Date().toISOString() });
  }

  private shouldIgnore(url: string) {
    return this.ignore.some((prefix) => url.startsWith(prefix));
  }

  // ---- console.error -------------------------------------------------

  private patchConsole(win: Window & typeof globalThis) {
    const original = win.console.error;
    win.console.error = (...args: unknown[]) => {
      try {
        this.record({
          type: "CONSOLE",
          message: sanitizeText(args.map(formatArg).join(" ")),
          stack: args.find((a) => a instanceof Error)
            ? sanitizeText((args.find((a) => a instanceof Error) as Error).stack ?? "", 4000)
            : undefined,
        });
      } catch {
        /* never break the page */
      }
      original.apply(win.console, args as []);
    };
    this.restore.push(() => (win.console.error = original));
  }

  // ---- uncaught exceptions, rejections, failed resources --------------

  private listenForErrors(win: Window & typeof globalThis) {
    const onError = (event: ErrorEvent | Event) => {
      const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
      // Resource errors (img, script, link) bubble in the capture phase only.
      if (target && target !== (win as unknown) && (target.src || target.href)) {
        const url = target.src || target.href || "";
        if (!this.shouldIgnore(url)) {
          this.record({
            type: "NETWORK",
            method: "GET",
            url: sanitizeUrl(url, win.location.href),
            statusCode: 0,
            message: "Resource failed to load",
          });
        }
        return;
      }
      const e = event as ErrorEvent;
      this.record({
        type: "ERROR",
        message: sanitizeText(e.message || "Uncaught error"),
        stack: e.error?.stack ? sanitizeText(e.error.stack, 4000) : undefined,
        url: e.filename ? sanitizeUrl(`${e.filename}:${e.lineno}:${e.colno}`) : undefined,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.record({
        type: "ERROR",
        message: sanitizeText(`Unhandled promise rejection: ${formatArg(reason)}`),
        stack: reason instanceof Error ? sanitizeText(reason.stack ?? "", 4000) : undefined,
      });
    };
    win.addEventListener("error", onError, true);
    win.addEventListener("unhandledrejection", onRejection);
    this.restore.push(() => {
      win.removeEventListener("error", onError, true);
      win.removeEventListener("unhandledrejection", onRejection);
    });
  }

  // ---- fetch ----------------------------------------------------------

  private patchFetch(win: Window & typeof globalThis) {
    if (typeof win.fetch !== "function") return;
    const original = win.fetch;
    const self = this;
    win.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const started = Date.now();
      const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const absolute = safeAbsolute(rawUrl, win.location.href);
      const skip = self.shouldIgnore(absolute);

      return original.call(win, input as RequestInfo, init).then(
        (response) => {
          if (!skip && !response.ok) {
            self.record({
              type: "NETWORK",
              method,
              url: sanitizeUrl(absolute),
              statusCode: response.status,
              durationMs: Date.now() - started,
              message: response.statusText || undefined,
            });
          }
          return response;
        },
        (error) => {
          if (!skip) {
            self.record({
              type: "NETWORK",
              method,
              url: sanitizeUrl(absolute),
              statusCode: 0,
              durationMs: Date.now() - started,
              message: sanitizeText(`Network error: ${formatArg(error)}`),
            });
          }
          throw error;
        },
      );
    } as typeof win.fetch;
    this.restore.push(() => (win.fetch = original));
  }

  // ---- XMLHttpRequest -------------------------------------------------

  private patchXhr(win: Window & typeof globalThis) {
    const Xhr = win.XMLHttpRequest;
    if (!Xhr) return;
    const proto = Xhr.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const self = this;

    proto.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
      this.__if = { method: String(method).toUpperCase(), url: safeAbsolute(String(url), win.location.href) };
      return (originalOpen as any).call(this, method, url, ...rest);
    };
    proto.send = function (this: any, body?: any) {
      const meta = this.__if as { method: string; url: string } | undefined;
      if (meta && !self.shouldIgnore(meta.url)) {
        const started = Date.now();
        this.addEventListener("loadend", () => {
          if (this.status === 0 || this.status >= 400) {
            self.record({
              type: "NETWORK",
              method: meta.method,
              url: sanitizeUrl(meta.url),
              statusCode: this.status,
              durationMs: Date.now() - started,
              message: this.status === 0 ? "Network error" : this.statusText || undefined,
            });
          }
        });
      }
      return originalSend.call(this, body);
    };
    this.restore.push(() => {
      proto.open = originalOpen;
      proto.send = originalSend;
    });
  }
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function safeAbsolute(url: string, base: string) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}
