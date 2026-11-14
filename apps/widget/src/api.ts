import { CapturedEvent } from "./collector";
import { Shape } from "./editor";

export interface WidgetConfig {
  projectName: string;
  maxScreenshotBytes: number;
  captures: string[];
}

export interface ReportPayload {
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";
  pageUrl: string;
  viewport: string;
  userAgent: string;
  buildId?: string;
  events: CapturedEvent[];
  annotations: { type: Shape["type"]; shapeJson: Record<string, number> }[];
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Talks to the InspectFlow API. It keeps its own reference to the browser's
 * original fetch, so the widget's own requests never show up as "failed
 * requests" in the evidence it collects.
 */
export class ApiClient {
  private readonly doFetch: typeof fetch;

  constructor(
    private readonly baseUrl: string,
    private readonly projectKey: string,
  ) {
    this.doFetch = window.fetch.bind(window);
  }

  getConfig() {
    return this.request<WidgetConfig>("/widget/config");
  }

  login(email: string, password: string) {
    return this.request<{ accessToken: string; user: { name: string }; role: string }>(
      "/widget/login",
      { method: "POST", body: JSON.stringify({ email, password }), json: true },
    );
  }

  submit(token: string, payload: ReportPayload, screenshot: Blob) {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("screenshot", screenshot, "screenshot.png");
    return this.request<{ id: string; number: number }>("/reports", {
      method: "POST",
      body: form,
      token,
    });
  }

  private async request<T>(
    path: string,
    opts: { method?: string; body?: BodyInit; token?: string; json?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { "X-InspectFlow-Key": this.projectKey };
    if (opts.json) headers["Content-Type"] = "application/json";
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

    let res: Response;
    try {
      res = await this.doFetch(this.baseUrl + path, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body,
      });
    } catch {
      throw new ApiError("Could not reach InspectFlow. Check your connection.", 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      throw new ApiError(msg || `Request failed (${res.status})`, res.status);
    }
    return data as T;
  }
}
