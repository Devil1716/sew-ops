"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { Field, FormError, Modal, ModalActions, describeError, inputClass } from "@/components/admin/kit";
import { useAdminLines, useAdminMachines, useAdminShifts } from "@/features/admin/hooks";
import {
  useAssignmentsList,
  useCreateAssignment,
  useEndAssignment,
  useUsersList,
  type LiveAssignment,
} from "@/features/people/hooks";

type AssignmentState = "upcoming" | "current" | "ends-today" | "ended";

const STATE_LABEL: Record<AssignmentState, string> = {
  upcoming: "Upcoming",
  current: "Current",
  "ends-today": "Ends today",
  ended: "Ended",
};
const STATE_COLOR: Record<AssignmentState, string> = {
  upcoming: "var(--status-maintenance)",
  current: "var(--status-running)",
  "ends-today": "var(--status-idle)",
  ended: "var(--status-offline)",
};

const todayLocal = () => new Date().toLocaleDateString("en-CA");
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });

function stateOf(a: LiveAssignment, today: string): AssignmentState {
  if (a.startDate > today) return "upcoming";
  if (a.endDate && a.endDate < today) return "ended";
  if (a.endDate === today) return "ends-today";
  return "current";
}

function AssignModal({ onClose }: { onClose: () => void }) {
  const users = useUsersList().data ?? [];
  const machines = useAdminMachines().data ?? [];
  const lines = useAdminLines().data ?? [];
  const shifts = useAdminShifts().data ?? [];
  const create = useCreateAssignment();
  const [userId, setUserId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [start, setStart] = useState(todayLocal());
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const operators = users.filter((u) => u.role === "operator" && u.isActive);
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const activeMachines = machines.filter((m) => m.isActive);
  const activeShifts = shifts.filter((s) => s.isActive);

  const submit = () => {
    setError(null);
    if (!userId || !machineId || !shiftId) return setError("Choose an operator, a machine and a shift.");
    if (!start) return setError("Choose a start date.");
    if (end && end < start) return setError("The end date cannot be before the start date.");
    create.mutate(
      { userId, machineId, shiftId, startDate: start, endDate: end || undefined },
      { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
    );
  };

  return (
    <Modal
      title="New assignment"
      description="One operator per machine per shift. Assignments run in whole days."
      onClose={onClose}
    >
      <Field label="Operator">
        <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Choose…</option>
          {operators.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.employeeCode})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Machine">
          <select className={inputClass} value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">Choose…</option>
            {activeMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} · {lineName.get(m.lineId) ?? "Line"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shift">
          <select className={inputClass} value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">Choose…</option>
            {activeShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startsAt}–{s.endsAt})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Until (optional)" hint="Leave empty to run until you end it.">
          <input className={inputClass} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <FormError message={error} />
      <ModalActions onCancel={onClose} onSubmit={submit} busy={create.isPending} submitLabel="Create assignment" />
    </Modal>
  );
}

export default function AssignmentsPage() {
  const list = useAssignmentsList();
  const end = useEndAssignment();
  const [view, setView] = useState<"open" | "all">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayLocal();
  const all = list.data ?? [];
  const rows = (view === "all" ? all : all.filter((a) => stateOf(a, today) !== "ended")).slice().sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || a.operatorName.localeCompare(b.operatorName),
  );
  const busyId = end.isPending ? end.variables?.id : undefined;

  const columns = useMemo<ColumnDef<LiveAssignment, unknown>[]>(
    () => [
      {
        id: "operator",
        header: "Operator",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.operatorName}</span>
            <span className="font-data text-xs text-[var(--muted)]">{row.original.employeeCode}</span>
          </div>
        ),
      },
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
      { id: "shift", header: "Shift", cell: ({ row }) => row.original.shiftName },
      {
        id: "period",
        header: "Period",
        cell: ({ row }) => (
          <span className="text-xs">
            {fmtDay(row.original.startDate)} → {row.original.endDate ? fmtDay(row.original.endDate) : "open-ended"}
          </span>
        ),
      },
      {
        id: "state",
        header: "State",
        cell: ({ row }) => {
          const s = stateOf(row.original, today);
          const color = STATE_COLOR[s];
          return (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
            >
              {STATE_LABEL[s]}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          stateOf(row.original, today) === "current" ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === row.original.id}
                onClick={() => {
                  setError(null);
                  end.mutate({ id: row.original.id, endDate: today }, { onError: (e) => setError(describeError(e)) });
                }}
              >
                End after today
              </Button>
            </div>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, busyId, end.mutate],
  );

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Operator assignments</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Who runs which machine on which shift. Ending an assignment keeps it valid until midnight; to cut access
            immediately, deactivate the user.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          New assignment
        </Button>
      </header>

      <div className="flex gap-2">
        <Button size="sm" variant={view === "open" ? "primary" : "secondary"} onClick={() => setView("open")}>
          Current and upcoming
        </Button>
        <Button size="sm" variant={view === "all" ? "primary" : "secondary"} onClick={() => setView("all")}>
          All history
        </Button>
      </div>

      {error && <ErrorState message={error} />}

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load assignments." onRetry={() => list.refetch()} />
      ) : (
        <DataTable data={rows} columns={columns} emptyTitle="No assignments yet" />
      )}

      {createOpen && <AssignModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}