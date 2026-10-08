import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@sew-ops/shared";
import { canAccessArea, roleHome } from "@/lib/auth/roles";

/**
 * UI-level role guard. This is a convenience redirect layer ONLY —
 * the backend must enforce real authorization on every endpoint.
 * The session role is mirrored in a readable cookie at login time.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = req.cookies.get("sew_ops_role")?.value as Role | undefined;

  if (!role) {
    const login = pathname.startsWith("/operator") ? "/operator-login" : "/login";
    const url = new URL(login, req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
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
  matcher: ["/manager/:path*", "/admin/:path*", "/operator/:path*"],
};
