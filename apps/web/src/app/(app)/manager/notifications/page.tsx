"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data/EmptyState";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { CheckboxField } from "@/components/admin/kit";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/features/notifications/hooks";
import { formatDateTime, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useNotifications(100, unreadOnly);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = list.data?.items ?? [];
  const unread = list.data?.unreadCount ?? 0;

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Alerts from the floor, live. Breaks and repeat reports of an open issue do not alert.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <CheckboxField checked={unreadOnly} onChange={setUnreadOnly} label="Unread only" />
          <Button variant="secondary" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read{unread > 0 ? ` (${unread})` : ""}
          </Button>
        </div>
      </header>

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load notifications." onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          body="When an operator reports a problem, it appears here and on the bell."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-[var(--border)]">
            {items.map((n) => (
              <li
                key={n.id}
                className={cn("flex items-start gap-3 px-4 py-3", !n.readAt && "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]")}
              >
                <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-[var(--accent)]")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</p>
                  <p className="text-sm text-[var(--muted)]">{n.body}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]" title={formatDateTime(n.createdAt)}>
                    {timeAgo(n.createdAt)} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {n.entityType === "issue" && (
                    <Link href="/manager/issues" className="text-xs text-[var(--accent)] hover:underline">
                      View issues
                    </Link>
                  )}
                  {!n.readAt && (
                    <button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => markRead.mutate(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}