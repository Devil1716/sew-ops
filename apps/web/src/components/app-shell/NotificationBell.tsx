"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMarkAllRead, useMarkRead, useNotifications, type AppNotification } from "@/features/notifications/hooks";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const t = useTranslations();
  const router = useRouter();
  const { data } = useNotifications(8);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    router.push(n.entityType === "issue" ? "/manager/issues" : "/manager/notifications");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`${t("app.notifications")}${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--text)_6%,var(--surface))]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--status-breakdown)] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-sm font-medium">{t("app.notifications")}</span>
            {unread > 0 && (
              <button type="button" className="text-xs text-[var(--accent)]" onClick={() => markAll.mutate()}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      "flex w-full gap-2 px-3 py-2 text-left hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]",
                      !n.readAt && "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
                    )}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-[var(--accent)]")} />
                    <span className="min-w-0">
                      <span className={cn("block truncate text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{n.body}</span>
                      <span className="block text-[10px] text-[var(--muted)]">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-[var(--border)] px-3 py-2 text-center">
            <Link href="/manager/notifications" onClick={() => setOpen(false)} className="text-xs text-[var(--accent)]">
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}