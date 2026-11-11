"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatMinutes } from "@/lib/time";
import {
  useAcknowledgeIssue,
  useIssueList,
  useResolveIssue,
  type IssueView,
  type LiveIssue,
} from "@/features/issues/hooks";

const camelize = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : "No connection. Try again.");

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "open"
      ? "var(--status-breakdown)"
      : status === "acknowledged"
        ? "var(--status-idle)"
        : "var(--status-running)";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {status}
    </span>
  );
}

export default function IssuesPage() {
  const t = useTranslations();
  const [view, setView] = useState<IssueView>("unresolved");
  const list = useIssueList(view);
  const ack = useAcknowledgeIssue();
  const resolve = useResolveIssue();
  const [resolving, setResolving] = useState<LiveIssue | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const busyId = ack.isPending ? ack.variables : resolve.isPending ? resolve.variables?.id : undefined;
  const label = useCallback((type: string) => t(`issue.${camelize(type)}`), [t]);

  const onAcknowledge = useCallback(
    (id: string) => {
      setActionError(null);
      ack.mutate(id, { onError: (e) => setActionError(messageOf(e)) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ack.mutate],
  );

  const submitResolve = () => {
    if (!resolving) return;
    setActionError(null);
    resolve.mutate(
      { id: resolving.id, resolutionNote: note.trim() },
      {
        onSuccess: () => setResolving(null),
        onError: (e) => setActionError(messageOf(e)),
      },
    );
  };

  const columns = useMemo<ColumnDef<LiveIssue, unknown>[]>(
    () => [
      {
        id: "issue",
        header: "Issue",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{label(row.original.type)}</span>
            {row.original.note && <span className="text-xs text-[var(--muted)]">{row.original.note}</span>}
          </div>
        ),
      },
      {
        id: "machine",
        header: "Machine",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-data">{row.original.machineCode}</span>
            <span className="text-xs text-[var(--muted)]">{row.original.lineName}</span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "opened",
        header: "Opened",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-xs">{formatDateTime(row.original.openedAt)}</span>
            <span className="font-data text-xs text-[var(--muted)]">
              {formatMinutes(row.original.durationMinutes)}
              {row.original.status === "resolved" ? " total" : " so far"}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const issue = row.original;
          if (issue.status === "resolved") {
            return <span className="text-xs text-[var(--muted)]">{issue.resolutionNote ?? "Resolved"}</span>;
          }
          const busy = busyId === issue.id;
          return (
            <div className="flex justify-end gap-2">
              {issue.status === "open" && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAcknowledge(issue.id)}>
                  Acknowledge
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => {
                  setActionError(null);
                  setNote("");
                  setResolving(issue);
                }}
              >
                Resolve
              </Button>
            </div>
          );
        },
      },
    ],
    [label, busyId, onAcknowledge],
  );

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Issues</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Reported from the floor. Acknowledge to say you are on it, resolve when it is fixed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={view === "unresolved" ? "primary" : "secondary"} onClick={() => setView("unresolved")}>
            Unresolved
          </Button>
          <Button size="sm" variant={view === "resolved" ? "primary" : "secondary"} onClick={() => setView("resolved")}>
            Resolved (7 days)
          </Button>
        </div>
      </header>

      {actionError && !resolving && <ErrorState message={actionError} />}

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load issues." onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          data={list.data ?? []}
          columns={columns}
          emptyTitle={view === "unresolved" ? "No open issues" : "Nothing was resolved in the last 7 days"}
          emptyBody={
            view === "unresolved"
              ? "Issues show up when an operator reports a problem from their terminal. Nothing is waiting right now."
              : "Resolved issues from the last 7 days will be listed here."
          }
          emptyActionLabel="View machines"
          emptyActionHref="/manager/machines"
        />
      )}

      <Dialog.Root open={resolving !== null} onOpenChange={(open) => !open && setResolving(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="app-surface fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-[var(--radius-lg)] p-6">
            <Dialog.Title className="text-lg font-semibold tracking-tight">Resolve issue</Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--muted)]">
              {resolving ? `${label(resolving.type)} · ${resolving.machineCode}` : ""}
            </Dialog.Description>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="What was done? (optional)"
              className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            {actionError && (
              <p role="alert" className="text-sm text-red-500">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setResolving(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={resolve.isPending} onClick={submitResolve}>
                {resolve.isPending ? "Saving…" : "Mark resolved"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}