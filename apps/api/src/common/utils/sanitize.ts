import { EventType } from "@prisma/client";

/**
 * Log sanitisation. Runs on the server for every captured event, whatever the
 * widget already did, so secrets never reach the database.
 */

export const MAX_EVENTS = 200;

const SENSITIVE_KEY =
  /(authorization|cookie|token|secret|passw|pwd|api[-_]?key|apikey|session|csrf|xsrf|jwt|bearer|credential|signature|sig|code|auth)/i;

const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
// key: value, key=value and "key":"value" forms for sensitive-looking keys
const KEY_VALUE =
  /(["']?(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|apikey|authorization|cookie|set-cookie|session(?:[_-]?id)?|csrf|xsrf)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}\]]+)/gi;

export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}...[truncated]` : value;
}

/** Removes credentials from free text such as console messages and stacks. */
export function sanitizeText(value: unknown, max = 2000): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  const cleaned = text
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(JWT, "[REDACTED_JWT]")
    .replace(KEY_VALUE, '$1"[REDACTED]"');
  return truncate(cleaned, max);
}

/** Drops credentials, sensitive query values and the fragment from a URL. */
export function sanitizeUrl(value: unknown, max = 500): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, "http://placeholder.invalid");
    const relative = !/^[a-z][a-z0-9+.-]*:/i.test(value);
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    const out = relative
      ? `${url.pathname}${url.search}`
      : url.toString();
    return truncate(out, max);
  } catch {
    return truncate(sanitizeText(value, max), max);
  }
}

export interface SanitizedEvent {
  type: EventType;
  method: string | null;
  url: string | null;
  statusCode: number | null;
  durationMs: number | null;
  message: string | null;
  stack: string | null;
  timestamp: Date;
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

const clampInt = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : null;
};

/** Validates one widget event and removes sensitive content. */
export function sanitizeEvent(raw: any): SanitizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  if (!["CONSOLE", "NETWORK", "ERROR"].includes(raw.type)) return null;

  const method =
    typeof raw.method === "string" && METHODS.has(raw.method.toUpperCase())
      ? raw.method.toUpperCase()
      : null;
  const ts = new Date(raw.timestamp);

  return {
    type: raw.type as EventType,
    method,
    url: sanitizeUrl(raw.url),
    statusCode: clampInt(raw.statusCode, 0, 999),
    durationMs: clampInt(raw.durationMs, 0, 600_000),
    message: raw.message === undefined || raw.message === null ? null : sanitizeText(raw.message, 2000),
    stack: raw.stack === undefined || raw.stack === null ? null : sanitizeText(raw.stack, 4000),
    timestamp: Number.isNaN(ts.getTime()) ? new Date() : ts,
  };
}

export function sanitizeEvents(list: unknown): SanitizedEvent[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_EVENTS)
    .map(sanitizeEvent)
    .filter((e): e is SanitizedEvent => e !== null);
}
