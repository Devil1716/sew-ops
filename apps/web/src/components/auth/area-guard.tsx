"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { canAccessArea, roleHome } from "@/lib/auth/roles";
import { areaOf, useSession } from "@/lib/auth/session";

/** Blocks a manager (or operator) who reaches /admin even if the edge redirect is skipped. */
export function AreaGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const area = areaOf(path);
  const session = useSession(area !== null);
  const me = session.data;
  const blocked = area !== null && session.isSuccess && !!me && !canAccessArea(me.role, area);
  const checking = area === "admin" && session.isPending;

  useEffect(() => {
    if (blocked && me) router.replace(roleHome(me.role));
  }, [blocked, me, router]);

  if (checking) {
    return <p className="px-6 py-8 text-sm text-[var(--muted)]">Checking access…</p>;
  }
  if (blocked) {
    return <p className="px-6 py-8 text-sm text-[var(--muted)]">Opening your dashboard…</p>;
  }
  return <>{children}</>;
}
