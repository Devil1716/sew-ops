"use client";
import { useQuery } from "@tanstack/react-query";
import type { Role } from "@sew-ops/shared";
import { api } from "@/lib/api/client";
import { canAccessArea, roleHome, type Area } from "@/lib/auth/roles";
import { disconnectSocket } from "@/lib/realtime/socket";

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  factoryIds: string[];
}

export const SESSION_KEY = ["session"] as const;

/** Who is logged in. Source of truth is the server (/auth/me), never a cookie we wrote. */
export function useSession(enabled = true) {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => (await api.get<{ user: SessionUser }>("/auth/me")).user,
    retry: false,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function areaOf(path: string): Area | null {
  if (/^\/admin(\/|$)/.test(path)) return "admin";
  if (/^\/manager(\/|$)/.test(path)) return "manager";
  if (/^\/operator(\/|$)/.test(path)) return "operator";
  return null;
}

export function loginPathFor(path: string): string {
  const base = areaOf(path) === "operator" ? "/operator-login" : "/login";
  return `${base}?next=${encodeURIComponent(path)}`;
}

/** Only same-site paths the role may open; anything else goes to the role's home. */
export function safeNext(next: string | null, role: Role): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
    const area = areaOf(next);
    if (area && canAccessArea(role, area)) return next;
  }
  return roleHome(role);
}

export async function performLogout() {
  const path = window.location.pathname;
  try {
    await api.post("/auth/logout");
  } catch {
    // Even if the server is unreachable, leave the screen.
  }
  disconnectSocket();
  window.location.assign(areaOf(path) === "operator" ? "/operator-login" : "/login");
}