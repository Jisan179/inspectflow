/**
 * Client-side log sanitisation. The server repeats the same cleaning
 * (it is the real authority), but removing secrets here means they never
 * even leave the tester's browser.
 */

const SENSITIVE_KEY =
  /(authorization|cookie|token|secret|passw|pwd|api[-_]?key|apikey|session|csrf|xsrf|jwt|bearer|credential|signature|sig|code|auth)/i;
const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const KEY_VALUE =
  /(["']?(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|apikey|authorization|cookie|set-cookie|session(?:[_-]?id)?|csrf|xsrf)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}\]]+)/gi;

export const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}...[truncated]` : value;

export function sanitizeText(value: unknown, max = 2000): string {
  const text = typeof value === "string" ? value : String(value ?? "");
  return truncate(
    text
      .replace(BEARER, "Bearer [REDACTED]")
      .replace(JWT, "[REDACTED_JWT]")
      .replace(KEY_VALUE, '$1"[REDACTED]"'),
    max,
  );
}

/** Removes credentials, sensitive query values and the hash from a URL. */
export function sanitizeUrl(value: string, base?: string, max = 500): string {
  try {
    const url = new URL(value, base ?? "http://placeholder.invalid");
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return truncate(url.toString(), max);
  } catch {
    return truncate(sanitizeText(value, max), max);
  }
}
