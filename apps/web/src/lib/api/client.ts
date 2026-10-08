import { API_BASE_URL, USE_FIXTURES } from "@/lib/constants";
import { resolveFixture } from "@/lib/api/fixtures";
import { newIdempotencyKey } from "@/lib/utils";

/**
 * THE one fetch wrapper. Every API call in the app goes through here:
 * base URL from env, auth header, error normalization, retry with backoff.
 * When NEXT_PUBLIC_USE_FIXTURES=true (dev only) paths with a registered
 * fixture resolve locally instead of hitting the network.
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

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("sew_ops_token");
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, signal, retries = 2, headers = {} } = options;

  if (USE_FIXTURES) {
    const fixture = resolveFixture<T>(path);
    if (fixture !== undefined) return fixture;
  }

  const token = getAccessToken();
  let attempt = 0;

  for (;;) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

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

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
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

/** POST with an Idempotency-Key header (operator events). */
export function apiPostIdempotent<T>(path: string, body: unknown, idempotencyKey?: string) {
  return apiFetch<T>(path, {
    method: "POST",
    body,
    retries: 3,
    headers: { "Idempotency-Key": idempotencyKey ?? newIdempotencyKey() },
  });
}
