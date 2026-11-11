"use client";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { useLineProgress, type LineProgressLive } from "@/features/kpis/hooks";
import { useSession } from "@/lib/auth/session";
import { useMachineBoard } from "@/features/machines/live";
import { formatPercent } from "@/lib/utils";

export default function LinesPage() {
  const { data: me } = useSession();
  const lines = useLineProgress();
  const machines = useMachineBoard();
  const all = machines.data ?? [];

  const columns = useMemo<ColumnDef<LineProgressLive, unknown>[]>(
    () => [
      {
        id: "line",
        header: "Line",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.lineName}</span>
            <span className="font-data text-xs text-[var(--muted)]">{row.original.lineCode}</span>
          </div>
        ),
      },
      {
        id: "work",
        header: "Working on",
        cell: ({ row }) =>
          row.original.garment ? (
            <div className="flex flex-col">
              <span>{row.original.garment}</span>
              <span className="font-data text-xs text-[var(--muted)]">{row.original.orderNumbers.join(", ")}</span>
            </div>
          ) : (
            <span className="text-xs text-[var(--muted)]">No active work order</span>
          ),
      },
      {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const { completed, target } = row.original;
          const width = target > 0 ? Math.min(100, (completed / target) * 100) : 0;
          return (
            <div className="flex min-w-48 flex-col gap-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
              </div>
              <span className="font-data text-xs text-[var(--muted)]">
                {completed} / {target} · {formatPercent(completed, target)}
              </span>
            </div>
          );
        },
      },
      {
        id: "machines",
        header: "Machines running",
        cell: ({ row }) => {
          const mine = all.filter((m) => m.lineId === row.original.lineId);
          const running = mine.filter((m) => m.status === "running").length;
          return (
            <span className="font-data">
              {running} / {mine.length}
            </span>
          );
        },
      },
    ],
    [all],
  );

  return (
    <div className="space-y-6 py-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Lines</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">What each line is working on and how far along it is.</p>
      </header>
      {lines.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : lines.isError ? (
        <ErrorState message="Could not load lines." onRetry={() => lines.refetch()} />
      ) : (
        <DataTable
          data={lines.data ?? []}
          columns={columns}
          emptyTitle="No lines yet"
          emptyBody="Lines are created in Floor setup. A line has to exist before machines or work orders can be placed on it."
          emptyActionLabel={me?.role === "admin" ? "Open floor setup" : undefined}
          emptyActionHref={me?.role === "admin" ? "/admin/floor" : undefined}
        />
      )}
    </div>
  );
}