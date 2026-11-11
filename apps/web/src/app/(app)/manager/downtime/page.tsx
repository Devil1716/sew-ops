"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { KpiCard } from "@/components/data/KpiCard";
import { KpiSkeleton, RowSkeleton } from "@/components/data/Skeletons";
import { useDowntimeList, type DowntimeRange, type DowntimeRow } from "@/features/downtime/hooks";
import { formatDateTime, formatMinutes } from "@/lib/time";

const camelize = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export default function DowntimePage() {
  const t = useTranslations();
  const [range, setRange] = useState<DowntimeRange>("24h");
  const list = useDowntimeList(range);
  const rows = list.data ?? [];

  const totals = useMemo(() => {
    const planned = rows.filter((r) => r.planned).reduce((s, r) => s + r.minutes, 0);
    const unplanned = rows.filter((r) => !r.planned).reduce((s, r) => s + r.minutes, 0);
    return { events: rows.length, planned: Math.round(planned), unplanned: Math.round(unplanned) };
  }, [rows]);

  const columns = useMemo<ColumnDef<DowntimeRow, unknown>[]>(
    () => [
      {
        id: "machine",
        header: "Machine",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-data">{row.original.machineCode}</span>
            <span className="text-xs text-[var(--muted)]">{row.original.machineName}</span>
          </div>
        ),
      },
      {
        id: "reason",
        header: "Reason",
        cell: ({ row }) => t(`issue.${camelize(row.original.reason)}`),
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-xs text-[var(--muted)]">{row.original.planned ? "Planned" : "Unplanned"}</span>
        ),
      },
      {
        id: "started",
        header: "Started",
        cell: ({ row }) => <span className="text-xs">{formatDateTime(row.original.startedAt)}</span>,
      },
      {
        id: "ended",
        header: "Ended",
        cell: ({ row }) =>
          row.original.ongoing || !row.original.endedAt ? (
            <span className="text-xs font-medium text-[var(--status-breakdown)]">Ongoing</span>
          ) : (
            <span className="text-xs">{formatDateTime(row.original.endedAt)}</span>
          ),
      },
      {
        id: "duration",
        header: "Duration",
        cell: ({ row }) => <span className="font-data">{formatMinutes(row.original.minutes)}</span>,
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Downtime</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Where the minutes went, by machine and reason.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={range === "24h" ? "primary" : "secondary"} onClick={() => setRange("24h")}>
            Last 24 hours
          </Button>
          <Button size="sm" variant={range === "7d" ? "primary" : "secondary"} onClick={() => setRange("7d")}>
            Last 7 days
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {list.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Stops" value={totals.events} />
            <KpiCard label="Unplanned downtime" value={totals.unplanned} unit="min" colorVar="var(--status-breakdown)" />
            <KpiCard label="Planned (breaks)" value={totals.planned} unit="min" colorVar="var(--status-idle)" />
          </>
        )}
      </div>

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load downtime." onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          emptyTitle="No downtime in this period"
          emptyBody="Stops and breakdowns are listed here after they are reported on the floor."
          emptyActionLabel="View machines"
          emptyActionHref="/manager/machines"
        />
      )}
    </div>
  );
}