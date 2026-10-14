import { API_BASE_URL, USE_FIXTURES } from "@/lib/constants";
import { resolveFixture } from "@/lib/api/fixtures";
import { newIdempotencyKey } from "@/lib/utils";

/**
 * THE one fetch wrapper. Every API call in the app goes through here:
 * base URL from env, httpOnly-cookie auth (no tokens in JavaScript), silent
 * session refresh on 401, error normalization, retry with backoff.
 * When NEXT_PUBLIC_USE_FIXTURES=true (dev only), non-auth paths with a
 * registered fixture resolve locally instead of hitting the network.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  retries?: number;
  headers?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isAuthPath = (path: string) => path.startsWith("/auth/");

/** Endpoints already wired to the real backend: never answered by dev fixtures. */
const LIVE_PREFIXES = ["/auth", "/operator", "/production", "/dashboard", "/machines", "/issues", "/downtime"];
const isLivePath = (path: string) =>
  LIVE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));

export const AUTH_LOST_EVENT = "sewops:auth-lost";

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every caller in this tab. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, signal, retries = 2, headers = {} } = options;

  if (USE_FIXTURES && method === "GET" && !isLivePath(path)) {
    const fixture = resolveFixture<T>(path);
    if (fixture !== undefined) return fixture;
  }

  let attempt = 0;
  let refreshed = false;

  for (;;) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        signal,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (res.status === 401 && !isAuthPath(path)) {
        if (!refreshed) {
          // Retry once after a refresh attempt, even if it failed: another tab
          // may already have refreshed the shared cookie.
          refreshed = true;
          await refreshSession();
          continue;
        }
        if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_LOST_EVENT));
      }

      if (!res.ok) {
        const payload: unknown = await res.json().catch(() => undefined);
        if (res.status >= 500 && attempt < retries) {
          attempt += 1;
          await sleep(300 * 2 ** attempt);
          continue;
        }
        const message =
          typeof payload === "object" && payload !== null && "message" in payload
            ? String((payload as { message: unknown }).message)
            : res.statusText;
        throw new ApiError(res.status, message, payload);
      }

      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (signal?.aborted) throw err;
      if (attempt < retries) {
        attempt += 1;
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
}

export const api = {
  get: <T>(path: string, opts?: Omit<ApiFetchOptions, "method">) =>
    apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<ApiFetchOptions, "method">) =>
    apiFetch<T>(path, { ...opts, method: "DELETE" }),
};

/** POST with an Idempotency-Key header (operator events). Reworked when the operator terminal is connected. */
export function apiPostIdempotent<T>(path: string, body: unknown, idempotencyKey?: string) {
  return apiFetch<T>(path, {
    method: "POST",
    body,
    retries: 3,
    headers: { "Idempotency-Key": idempotencyKey ?? newIdempotencyKey() },
  });
}