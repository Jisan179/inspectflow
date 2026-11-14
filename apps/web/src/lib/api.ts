/**
 * Small API client for the InspectFlow dashboard.
 * - Sends the access token as a Bearer header.
 * - On a 401 it tries the refresh token once, then retries the request.
 * - If refresh fails the session is cleared and the user returns to /login.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001").replace(/\/+$/, "");
export const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const ACCESS = "if_access";
const REFRESH = "if_refresh";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const store = {
  get: (k: string) => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const session = {
  hasToken: () => !!store.get(ACCESS),
  save(accessToken: string, refreshToken: string) {
    store.set(ACCESS, accessToken);
    store.set(REFRESH, refreshToken);
  },
  clear() {
    store.del(ACCESS);
    store.del(REFRESH);
  },
  refreshToken: () => store.get(REFRESH),
};

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = session.refreshToken();
  if (!refreshToken) return false;
  // Share one refresh between parallel requests (tokens are single use).
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      session.save(data.accessToken, data.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function messageFrom(data: any, fallback: string) {
  if (!data) return fallback;
  if (Array.isArray(data.message)) return data.message.join(", ");
  return data.message || fallback;
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const doRequest = () =>
    fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.auth !== false && store.get(ACCESS)
          ? { Authorization: `Bearer ${store.get(ACCESS)}` }
          : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res: Response;
  try {
    res = await doRequest();
  } catch {
    throw new ApiError("Cannot reach the server. It may be waking up, please retry in a few seconds.", 0);
  }

  if (res.status === 401 && options.auth !== false) {
    if (await refreshTokens()) {
      res = await doRequest();
    }
    if (res.status === 401) {
      session.clear();
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(messageFrom(data, `Request failed (${res.status})`), res.status);
  return data as T;
}

export const fetcher = <T = any>(path: string) => api<T>(path);
