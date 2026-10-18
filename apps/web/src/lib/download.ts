import { API_BASE_URL } from "@/lib/constants";
import { ApiError, refreshSession } from "@/lib/api/client";

/** Downloads a file from the API with the login cookie, then hands it to the browser. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const url = `${API_BASE_URL}${path}`;
  let res = await fetch(url, { credentials: "include" });
  if (res.status === 401 && (await refreshSession())) {
    res = await fetch(url, { credentials: "include" });
  }
  if (!res.ok) {
    const payload: unknown = await res.json().catch(() => undefined);
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(res.status, message, payload);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}