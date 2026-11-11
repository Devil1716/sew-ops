"use client";

import Link from "next/link";
import { Providers } from "@/components/providers-root";
import { roleHome } from "@/lib/auth/roles";
import { useSession } from "@/lib/auth/session";
import messages from "@/i18n/en.json";

function NotFoundBody() {
  const { data } = useSession();
  const href = data ? roleHome(data.role) : "/login";
  const label = data ? "Back to your dashboard" : "Back to SewOps";

  return (
    <div className="ops-app flex min-h-screen items-center justify-center px-6 text-[var(--text)]">
      <div className="app-surface w-full max-w-md space-y-5 rounded-[var(--radius-lg)] p-8 text-center">
        <div className="flex justify-center" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 20 20">
            <path d="M2 10 Q 6 2, 10 10 T 18 10" stroke="var(--accent)" strokeWidth="2" fill="none" />
            <circle cx="18" cy="10" r="1.5" fill="var(--accent)" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--text)_70%,var(--accent))]">
          SewOps
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm leading-relaxed text-[color-mix(in_srgb,var(--text)_72%,transparent)]">
          That address isn&apos;t part of the floor. Head back and pick up where you left off.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link
            href={href}
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] shadow-[var(--shadow-1)]"
          >
            {label}
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium"
          >
            Public site
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <Providers messages={messages} defaultTheme="light">
      <NotFoundBody />
    </Providers>
  );
}
