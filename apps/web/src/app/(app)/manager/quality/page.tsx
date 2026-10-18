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
import { CheckboxField, Field, FormError, Modal, ModalActions, describeError, inputClass } from "@/components/admin/kit";
import { useFactoriesList } from "@/features/factories/hooks";
import { useMachineBoard } from "@/features/machines/live";
import {
  DEFECT_TYPES,
  defectLabel,
  useCreateQualityCheck,
  useQualityChecks,
  useVoidQualityCheck,
  type QualityCheck,
} from "@/features/quality/hooks";
import { dayString, useQualityReport } from "@/features/reports/hooks";
import { useWorkOrderList } from "@/features/work-orders/hooks";
import { formatDateTime } from "@/lib/time";
import { newIdempotencyKey } from "@/lib/utils";

type RangeId = "today" | "7d" | "30d";
const RANGES: { id: RangeId; label: string; daysAgo: number }[] = [
  { id: "today", label: "Today", daysAgo: 0 },
  { id: "7d", label: "7 days", daysAgo: 6 },
  { id: "30d", label: "30 days", daysAgo: 29 },
];

function RecordModal({ onClose }: { onClose: () => void }) {
  const orders = (useWorkOrderList().data ?? []).filter((o) => o.status !== "cancelled");
  const machines = useMachineBoard().data ?? [];
  const create = useCreateQualityCheck();
  // One key per dialog: a double-click or a retry can never record the check twice.
  const [key] = useState(() => newIdempotencyKey());
  const [workOrderId, setWorkOrderId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [inspected, setInspected] = useState("");
  const [rejected, setRejected] = useState("0");
  const [defect, setDefect] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rejectedNum = Number(rejected === "" ? "0" : rejected);
  const showDefect = Number.isInteger(rejectedNum) && rejectedNum > 0;

  const submit = () => {
    setError(null);
    const ins = Number(inspected === "" ? "0" : inspected);
    const rej = Number(rejected === "" ? "0" : rejected);
    if (!workOrderId) return setError("Choose a work order.");
    if (!Number.isInteger(ins) || !Number.isInteger(rej) || ins < 0 || rej < 0) {
      return setError("Quantities must be whole numbers, 0 or more.");
    }
    if (ins === 0 && rej === 0) return setError("Enter an inspected or a rejected quantity.");
    if (ins > 0 && rej > ins) return setError("Rejected cannot be more than inspected.");
    if (rej > 0 && !defect) return setError("Choose the defect type.");

    create.mutate(
      {
        workOrderId,
        machineId: machineId || undefined,
        inspectedQty: ins,
        rejectedQty: rej,
        defectType: rej > 0 ? defect : undefined,
        note: note.trim() || undefined,
        idempotencyKey: key,
      },
      { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
    );
  };

  return (
    <Modal
      title="Record quality check"
      description="One defect type per check. If a batch has several, record the inspected quantity once, then add rows with 0 inspected for the other defects."
      onClose={onClose}
    >
      <Field label="Work order">
        <select className={inputClass} value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
          <option value="">Choose…</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber} · {o.garment}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Machine (optional)">
        <select className={inputClass} value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">Not specific</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} · {m.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inspected">
          <input className={inputClass} type="number" min={0} value={inspected} onChange={(e) => setInspected(e.target.value)} />
        </Field>
        <Field label="Rejected">
          <input className={inputClass} type="number" min={0} value={rejected} onChange={(e) => setRejected(e.target.value)} />
        </Field>
      </div>
      {showDefect && (
        <Field label="Defect type">
          <select className={inputClass} value={defect} onChange={(e) => setDefect(e.target.value)}>
            <option value="">Choose…</option>
            {DEFECT_TYPES.map((d) => (
              <option key={d} value={d}>
                {defectLabel(d)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Note (optional)">
        <textarea
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)]"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <FormError message={error} />
      <ModalActions onCancel={onClose} onSubmit={submit} busy={create.isPending} submitLabel="Record check" />
    </Modal>
  );
}

function VoidModal({ check, onClose }: { check: QualityCheck; onClose: () => void }) {
  const voidCheck = useVoidQualityCheck();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="Void this check?"
      description={`${check.orderNumber}: ${check.inspectedQty} inspected, ${check.rejectedQty} rejected. It is kept for the record but leaves all totals and reports.`}
      onClose={onClose}
      size="sm"
    >
      <FormError message={error} />
      <ModalActions
        onCancel={onClose}
        onSubmit={() => voidCheck.mutate(check.id, { onSuccess: onClose, onError: (e) => setError(describeError(e)) })}
        busy={voidCheck.isPending}
        submitLabel="Void check"
      />
    </Modal>
  );
}

export default function QualityPage() {
  const factories = useFactoriesList().data ?? [];
  const [fid, setFid] = useState("");
  const factoryId = factories.length > 1 ? fid || factories[0]?.id : undefined;
  const [range, setRange] = useState<RangeId>("today");
  const [showVoided, setShowVoided] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [voiding, setVoiding] = useState<QualityCheck | null>(null);

  const daysAgo = RANGES.find((r) => r.id === range)?.daysAgo ?? 0;
  const report = useQualityReport(dayString(daysAgo), dayString(0), factoryId);
  const checks = useQualityChecks(showVoided);
  const r = report.data;
  const maxDefect = Math.max(1, ...(r?.byDefect ?? []).map((d) => d.rejected));

  const columns = useMemo<ColumnDef<QualityCheck, unknown>[]>(
    () => [
      { id: "when", header: "When", cell: ({ row }) => <span className="text-xs">{formatDateTime(row.original.checkedAt)}</span> },
      {
        id: "order",
        header: "Work order",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-data">{row.original.orderNumber}</span>
            <span className="text-xs text-[var(--muted)]">{row.original.machineCode ?? "No specific machine"}</span>
          </div>
        ),
      },
      { id: "ins", header: "Inspected", cell: ({ row }) => <span className="font-data">{row.original.inspectedQty}</span> },
      { id: "rej", header: "Rejected", cell: ({ row }) => <span className="font-data">{row.original.rejectedQty}</span> },
      {
        id: "defect",
        header: "Defect",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{defectLabel(row.original.defectType)}</span>
            {row.original.note && <span className="text-xs text-[var(--muted)]">{row.original.note}</span>}
          </div>
        ),
      },
      { id: "by", header: "By", cell: ({ row }) => <span className="text-xs">{row.original.inspector ?? "—"}</span> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.voided ? (
            <span className="text-xs text-[var(--muted)]">Voided</span>
          ) : (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setVoiding(row.original)}>
                Void
              </Button>
            </div>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Quality</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Inspections and rejects. A mistaken entry is voided, never deleted.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {factories.length > 1 && (
            <select className={`${inputClass} w-auto`} value={factoryId ?? ""} onChange={(e) => setFid(e.target.value)}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {RANGES.map((x) => (
            <Button key={x.id} size="sm" variant={range === x.id ? "primary" : "secondary"} onClick={() => setRange(x.id)}>
              {x.label}
            </Button>
          ))}
          <Button variant="primary" onClick={() => setRecordOpen(true)}>
            Record check
          </Button>
        </div>
      </header>

      {report.isError ? (
        <ErrorState message="Could not load the quality summary." onRetry={() => report.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {report.isLoading || !r ? (
            Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              <KpiCard label="Inspected" value={r.totals.inspected} />
              <KpiCard label="Rejected" value={r.totals.rejected} colorVar="var(--status-breakdown)" />
              <RateCard label="Reject rate" value={r.totals.rejectRatePct} />
            </>
          )}
        </div>
      )}

      {r && (r.byDefect.length > 0 || r.byWorkOrder.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-sm font-medium">Rejects by defect</h2>
            {r.byDefect.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No rejects in this period.</p>
            ) : (
              r.byDefect.map((d) => (
                <div key={d.defectType} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{defectLabel(d.defectType)}</span>
                    <span className="font-data">{d.rejected}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                    <div className="h-full rounded-full bg-[var(--status-breakdown)]" style={{ width: `${(d.rejected / maxDefect) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </Card>
          <Card className="space-y-3">
            <h2 className="text-sm font-medium">Reject rate by work order</h2>
            {r.byWorkOrder.map((w) => (
              <div key={w.orderNumber} className="flex items-center justify-between text-sm">
                <span className="font-data">{w.orderNumber}</span>
                <span className="font-data text-[var(--muted)]">
                  {w.rejected} / {w.inspected} · {w.rejectRatePct}%
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Recent checks</h2>
        <CheckboxField checked={showVoided} onChange={setShowVoided} label="Show voided" />
      </div>

      {checks.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : checks.isError ? (
        <ErrorState message="Could not load quality checks." onRetry={() => checks.refetch()} />
      ) : (
        <DataTable data={checks.data ?? []} columns={columns} emptyTitle="No quality checks yet" />
      )}

      {recordOpen && <RecordModal onClose={() => setRecordOpen(false)} />}
      {voiding && <VoidModal check={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}