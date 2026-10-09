"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { refreshSession } from "@/lib/api/client";
import { loginPathFor } from "@/lib/auth/session";

export default function SessionPage() {
  const router = useRouter();

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next") ?? "/";
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    void refreshSession().then((ok) => {
      // Tells the route guard we already tried, so a failure cannot loop.
      document.cookie = "sewops_refreshed=1; path=/; max-age=10; samesite=lax";
      router.replace(ok ? next : loginPathFor(next));
    });
  }, [router]);

  return <p className="text-sm text-[var(--muted)]">Restoring your session…</p>;
}