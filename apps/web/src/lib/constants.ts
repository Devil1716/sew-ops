/** App-wide constants that are NOT business data. */

/**
 * Resolves API base URL.
 * In production / same-origin setups, defaults to '/v1' (relative path).
 * Trims trailing slashes and ensures /v1 suffix is present.
 */
function resolveApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!envUrl) {
    return "/v1";
  }
  const clean = envUrl.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? clean : `${clean}/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const REALTIME_URL = (process.env.NEXT_PUBLIC_REALTIME_URL ?? "").replace(/\/$/, "");
export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "true";

/** Operator terminal behavior */
export const OPERATOR_DOUBLE_TAP_LOCK_MS = 600;
export const OPERATOR_UNDO_WINDOW_MS = 5_000;
export const OPERATOR_MIN_TOUCH_PX = 48;

/** Motion: restrained in-app, expressive in marketing */
export const APP_TRANSITION_MS = 200;
