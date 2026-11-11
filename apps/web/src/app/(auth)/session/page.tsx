"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, refreshSession } from "@/lib/api/client";
import { loginPathFor, safeNext, type SessionUser } from "@/lib/auth/session";

export default function SessionPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next") ?? "/";
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    void refreshSession().then(async (ok) => {
      // Tells the route guard we already tried, so a failure cannot loop.
      document.cookie = "sewops_refreshed=1; path=/; max-age=10; samesite=lax";
      if (!ok) {
        router.replace(loginPathFor(next));
        return;
      }
      try {
        const { user } = await api.get<{ user: SessionUser }>("/auth/me");
        router.replace(safeNext(next, user.role));
      } catch {
        router.replace(loginPathFor(next));
      }
    });
  }, [router]);

  return <p className="text-sm text-[var(--muted)]">Restoring your session…</p>;
}