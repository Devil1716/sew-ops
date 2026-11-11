"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { KpiCard } from "@/components/data/KpiCard";
import { RateCard } from "@/components/data/RateCard";
import { KpiSkeleton, RowSkeleton } from "@/components/data/Skeletons";
import { describeError, inputClass } from "@/components/admin/kit";
import { DateField } from "@/components/data/DateField";
import { useFactoriesList } from "@/features/factories/hooks";
import { defectLabel } from "@/features/quality/hooks";
import {
  dayString,
  daysBetween,
  reportPath,
  useDowntimeReport,
  useProductionReport,
  useQualityReport,
  type DowntimeReport,
  type ProductionReport,
  type QualityReport,
  type ReportKind,
} from "@/features/reports/hooks";
import { downloadFile } from "@/lib/download";

const TABS: { id: ReportKind; label: string }[] = [
  { id: "production", label: "Production" },
  { id: "downtime", label: "Downtime" },
  { id: "quality", label: "Quality" },
];
const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 6 },
  { label: "Last 30 days", days: 29 },
];

type ProdRow = ProductionReport["rows"][number];
type DownRow = DowntimeReport["rows"][number];
type QualRow = QualityReport["rows"][number];

export default function ReportsPage() {
  const factories = useFactoriesList().data ?? [];
  const [fid, setFid] = useState("");
  const factoryId = factories.length > 1 ? fid || factories[0]?.id : undefined;
  const [kind, setKind] = useState<ReportKind>("production");
  const [from, setFrom] = useState(dayString(6));
  const [to, setTo] = useState(dayString(0));
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const rangeError =
    !from || !to
      ? "Choose both dates."
      : from > to
        ? "“From” must be on or before “To”."
        : daysBetween(from, to) > 92
          ? "Reports are limited to 92 days at a time."
          : null;
  const ok = !rangeError;

  const production = useProductionReport(from, to, factoryId, ok && kind === "production");
  const downtime = useDowntimeReport(from, to, factoryId, ok && kind === "downtime");
  const quality = useQualityReport(from, to, factoryId, ok && kind === "quality");
  const active = kind === "production" ? production : kind === "downtime" ? downtime : quality;

  const prodColumns = useMemo<ColumnDef<ProdRow, unknown>[]>(
    () => [
      { id: "day", header: "Day", cell: ({ row }) => <span className="font-data text-xs">{row.original.day}</span> },
      { id: "line", header: "Line", cell: ({ row }) => <span className="font-data">{row.original.lineCode}</span> },
      { id: "machine", header: "Machine", cell: ({ row }) => <span className="font-data">{row.original.machineCode}</span> },
      { id: "order", header: "Work order", cell: ({ row }) => <span className="font-data">{row.original.orderNumber}</span> },
      { id: "pieces", header: "Pieces", cell: ({ row }) => <span className="font-data">{row.original.pieces}</span> },
    ],
    [],
  );
  const downColumns = useMemo<ColumnDef<DownRow, unknown>[]>(
    () => [
      { id: "line", header: "Line", cell: ({ row }) => <span className="font-data">{row.original.lineCode}</span> },
      { id: "machine", header: "Machine", cell: ({ row }) => <span className="font-data">{row.original.machineCode}</span> },
      { id: "reason", header: "Reason", cell: ({ row }) => defectLabel(row.original.reason) },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => <span className="text-xs text-[var(--muted)]">{row.original.planned ? "Planned" : "Unplanned"}</span>,
      },
      { id: "events", header: "Stops", cell: ({ row }) => <span className="font-data">{row.original.events}</span> },
      { id: "minutes", header: "Minutes", cell: ({ row }) => <span className="font-data">{row.original.minutes}</span> },
    ],
    [],
  );
  const qualColumns = useMemo<ColumnDef<QualRow, unknown>[]>(
    () => [
      { id: "day", header: "Day", cell: ({ row }) => <span className="font-data text-xs">{row.original.day}</span> },
      { id: "order", header: "Work order", cell: ({ row }) => <span className="font-data">{row.original.orderNumber}</span> },
      { id: "defect", header: "Defect", cell: ({ row }) => defectLabel(row.original.defectType) },
      { id: "ins", header: "Inspected", cell: ({ row }) => <span className="font-data">{row.original.inspected}</span> },
      { id: "rej", header: "Rejected", cell: ({ row }) => <span className="font-data">{row.original.rejected}</span> },
    ],
    [],
  );

  const onDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadFile(reportPath(kind, from, to, factoryId, true), `${kind}_${from}_${to}.csv`);
    } catch (e) {
      setDownloadError(describeError(e));
    } finally {
      setDownloading(false);
    }
  };

  const days = ok ? Math.max(1, Math.round(daysBetween(from, to))) : 1;

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pick a period, review it here, or download it as a spreadsheet. Days follow the factory&apos;s own clock.
          </p>
        </div>
        <Button variant="primary" disabled={!ok || downloading} onClick={() => void onDownload()}>
          {downloading ? "Preparing…" : "Download CSV"}
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Button key={t.id} size="sm" variant={kind === t.id ? "primary" : "secondary"} onClick={() => setKind(t.id)}>
              {t.label}
            </Button>
          ))}
        </div>
        {factories.length > 1 && (
          <select className={`${inputClass} w-auto`} value={factoryId ?? ""} onChange={(e) => setFid(e.target.value)}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="ghost"
              onClick={() => {
                setFrom(dayString(p.days));
                setTo(dayString(0));
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {rangeError && (
        <p role="alert" className="text-sm text-red-500">
          {rangeError}
        </p>
      )}
      {downloadError && <ErrorState message={downloadError} />}

      {ok && active.isError ? (
        <ErrorState message={describeError(active.error)} onRetry={() => active.refetch()} />
      ) : ok && active.isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
          <Card>
            <RowSkeleton />
          </Card>
        </>
      ) : ok && kind === "production" && production.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Pieces" value={production.data.totals.pieces} />
            <KpiCard label="Lines producing" value={production.data.byLine.length} />
            <KpiCard label="Average per day" value={Math.round(production.data.totals.pieces / days)} />
          </div>
          <DataTable data={production.data.rows} columns={prodColumns} emptyTitle="No production in this period" />
        </>
      ) : ok && kind === "downtime" && downtime.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Stops" value={downtime.data.totals.events} />
            <KpiCard label="Unplanned downtime" value={Math.round(downtime.data.totals.unplannedMinutes)} unit="min" colorVar="var(--status-breakdown)" />
            <KpiCard label="Planned (breaks)" value={Math.round(downtime.data.totals.plannedMinutes)} unit="min" colorVar="var(--status-idle)" />
          </div>
          <DataTable data={downtime.data.rows} columns={downColumns} emptyTitle="No downtime in this period" />
        </>
      ) : ok && kind === "quality" && quality.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Inspected" value={quality.data.totals.inspected} />
            <KpiCard label="Rejected" value={quality.data.totals.rejected} colorVar="var(--status-breakdown)" />
            <RateCard label="Reject rate" value={quality.data.totals.rejectRatePct} />
          </div>
          <DataTable data={quality.data.rows} columns={qualColumns} emptyTitle="No quality checks in this period" />
        </>
      ) : null}
    </div>
  );
}