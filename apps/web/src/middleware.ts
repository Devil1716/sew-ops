import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@sew-ops/shared";
import { canAccessArea, roleHome } from "@/lib/auth/roles";

/**
 * UI-level route guard: a convenience redirect layer ONLY. The API enforces
 * real authorization on every request. It reads the role from the (httpOnly,
 * server-issued) access cookie; a forged cookie only reveals an empty page shell.
 */
const ACCESS_COOKIE = "sewops_at";
const TRIED_COOKIE = "sewops_refreshed";
const ROLES: Role[] = ["admin", "manager", "operator"];

function readRole(token: string | undefined): Role | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as {
      role?: string;
      exp?: number;
    };
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    return ROLES.includes(payload.role as Role) ? (payload.role as Role) : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const operatorArea = pathname.startsWith("/operator");
  const role = readRole(req.cookies.get(ACCESS_COOKIE)?.value);

  if (!role) {
    // First try to restore the session silently; if that was just tried, go to login.
    const justTried = req.cookies.get(TRIED_COOKIE)?.value === "1";
    const target = justTried ? (operatorArea ? "/operator-login" : "/login") : "/session";
    const url = new URL(target, req.url);
    url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    if (justTried) res.cookies.delete(TRIED_COOKIE);
    return res;
  }

  const area = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/manager")
      ? "manager"
      : "operator";

  if (!canAccessArea(role, area)) {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/manager/:path*", "/manager", "/admin/:path*", "/admin", "/operator/:path*", "/operator"],
};