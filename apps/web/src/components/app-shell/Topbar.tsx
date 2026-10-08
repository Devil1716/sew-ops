"use client";
import { Bell, Command, HelpCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUiStore } from "@/stores/ui";
import { ThemeToggle } from "@/components/theme";
import { ConnectionBadge } from "@/components/data/ConnectionBadge";
import { AccountMenu } from "@/components/app-shell/AccountMenu";

export function Topbar() {
  const openPalette = useUiStore((s) => s.setCommandOpen);
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-4 backdrop-blur">
      <button
        type="button"
        onClick={() => openPalette(true)}
        className="group flex min-w-[280px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--text)_4%,var(--bg))]"
      >
        <Search className="h-4 w-4" />
        <span>{t("common.search")}…</span>
        <kbd className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          <Command className="h-3 w-3" /> K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <ConnectionBadge />
        <button
          type="button"
          aria-label={t("app.notifications")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--text)_6%,var(--surface))]"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t("app.help")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--text)_6%,var(--surface))]"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <div className="mx-1 h-5 w-[1px] bg-[var(--border)]" />
        <AccountMenu />
      </div>
    </header>
  );
}
