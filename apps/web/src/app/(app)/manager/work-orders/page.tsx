"use client";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { formatPercent } from "@/lib/utils";
import { useFactoriesList } from "@/features/factories/hooks";
import { useLinesList } from "@/features/lines/hooks";
import { useShiftsList } from "@/features/shifts/hooks";
import { useMachineBoard } from "@/features/machines/live";
import {
  useAddAssignment,
  useCreateWorkOrder,
  useRemoveAssignment,
  useUpdateWorkOrder,
  useWorkOrderList,
  type LiveWorkOrder,
  type WorkOrderStatus,
} from "@/features/work-orders/hooks";

type Variant = NonNullable<ButtonProps["variant"]>;

const STATUSES: WorkOrderStatus[] = ["active", "scheduled", "paused", "completed", "cancelled"];
const STATUS_RANK: Record<WorkOrderStatus, number> = { active: 0, paused: 1, scheduled: 2, completed: 3, cancelled: 4 };
const STATUS_COLOR: Record<WorkOrderStatus, string> = {
  active: "var(--status-running)",
  paused: "var(--status-idle)",
  scheduled: "var(--muted)",
  completed: "var(--status-maintenance)",
  cancelled: "var(--status-offline)",
};

/** The one-click actions shown on each row (cancel lives inside Manage). */
const ROW_ACTIONS: Record<WorkOrderStatus, { label: string; to: WorkOrderStatus; variant: Variant; confirm?: boolean }[]> = {
  scheduled: [{ label: "Start", to: "active", variant: "primary" }],
  active: [
    { label: "Pause", to: "paused", variant: "secondary" },
    { label: "Complete", to: "completed", variant: "primary", confirm: true },
  ],
  paused: [
    { label: "Resume", to: "active", variant: "primary" },
    { label: "Complete", to: "completed", variant: "secondary", confirm: true },
  ],
  completed: [],
  cancelled: [],
};

function describeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "No connection. Try again.";
  const payload = e.payload as { errors?: { path: string; message: string }[] } | undefined;
  if (payload?.errors?.length) {
    return payload.errors.map((x) => `${x.path || "field"}: ${x.message}`).join("; ");
  }
  return e.message;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

const inputClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {status}
    </span>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="app-surface fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-[var(--radius-lg)] p-6">
          <Dialog.Title className="text-lg font-semibold tracking-tight">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--muted)]">{body}</Dialog.Description>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Not yet
            </Button>
            <Button variant="primary" disabled={busy} onClick={onConfirm}>
              {busy ? "Saving…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useSession();
  const me = session.data;
  const factoryQuery = useFactoriesList();
  const lineQuery = useLinesList();
  const factories = factoryQuery.data ?? [];
  const lines = lineQuery.data ?? [];
  const create = useCreateWorkOrder();
  const [factoryId, setFactoryId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [styleCode, setStyleCode] = useState("");
  const [garment, setGarment] = useState("");
  const [target, setTarget] = useState("");
  const [start, setStart] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const effectiveFactory = factoryId || factories[0]?.id || me?.factoryIds[0] || "";

  const submit = () => {
    setError(null);
    const qty = Number(target);
    if (!orderNumber.trim() || !styleCode.trim() || !garment.trim()) return setError("Order number, style and garment are required.");
    if (!Number.isInteger(qty) || qty < 1) return setError("Target must be a whole number of at least 1.");
    if (!start) return setError("Choose a start date.");
    if (end && end < start) return setError("The end date cannot be before the start date.");
    if (!effectiveFactory) return setError("No factory found for your account.");

    create.mutate(
      {
        factoryId: effectiveFactory,
        orderNumber: orderNumber.trim().toUpperCase(),
        styleCode: styleCode.trim().toUpperCase(),
        garment: garment.trim(),
        quantityTarget: qty,
        plannedStart: new Date(`${start}T00:00:00`).toISOString(),
        plannedEnd: end ? new Date(`${end}T23:59:00`).toISOString() : undefined,
      },
      { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50" />
        <Dialog.Content className="app-surface fixed left-1/2 top-1/2 z-[80] max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-[var(--radius-lg)] p-6">
          <Dialog.Title className="text-lg font-semibold tracking-tight">New work order</Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--muted)]">
            It starts as Scheduled. Assign it to a line, then press Start.
          </Dialog.Description>
          {session.isSuccess && factoryQuery.isSuccess && !effectiveFactory && (
            <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm">
              No factory is available for your account yet. An admin needs to create one before a work order can be saved.
            </p>
          )}
          {lineQuery.isSuccess && lines.length === 0 && (
            <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm">
              Create a line first. You can save this order now, but it cannot be assigned until a line exists in Floor setup.{" "}
              {me?.role === "admin" ? (
                <Link href="/admin/floor" className="font-medium text-[var(--accent)] hover:underline" onClick={onClose}>
                  Open floor setup
                </Link>
              ) : (
                "An admin creates the line in Floor setup."
              )}
            </p>
          )}
          {factories.length > 1 && (
            <Field label="Factory">
              <select className={inputClass} value={effectiveFactory} onChange={(e) => setFactoryId(e.target.value)}>
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Order number">
              <input className={inputClass} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} maxLength={40} />
            </Field>
            <Field label="Style code">
              <input className={inputClass} value={styleCode} onChange={(e) => setStyleCode(e.target.value)} maxLength={40} />
            </Field>
          </div>
          <Field label="Garment">
            <input className={inputClass} value={garment} onChange={(e) => setGarment(e.target.value)} maxLength={120} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Target quantity">
              <input className={inputClass} type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Start date">
              <input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End date (optional)">
              <input className={inputClass} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" disabled={create.isPending || !effectiveFactory} onClick={submit}>
              {create.isPending ? "Creating…" : "Create work order"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ManageDialog({ wo, onClose }: { wo: LiveWorkOrder; onClose: () => void }) {
  const lines = useLinesList().data ?? [];
  const shifts = useShiftsList().data ?? [];
  const machines = useMachineBoard().data ?? [];
  const update = useUpdateWorkOrder();
  const add = useAddAssignment();
  const remove = useRemoveAssignment();

  const terminal = wo.status === "completed" || wo.status === "cancelled";
  const [target, setTarget] = useState(String(wo.quantityTarget));
  const [lineId, setLineId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lineMachines = machines.filter((m) => m.lineId === lineId);

  const saveTarget = () => {
    setError(null);
    const qty = Number(target);
    if (!Number.isInteger(qty) || qty < 1) return setError("Target must be a whole number of at least 1.");
    update.mutate({ id: wo.id, patch: { quantityTarget: qty } }, { onError: (e) => setError(describeError(e)) });
  };

  const addAssignment = () => {
    setError(null);
    if (!lineId) return setError("Choose a line.");
    add.mutate(
      { id: wo.id, lineId, machineId: machineId || undefined, shiftId: shiftId || undefined },
      {
        onSuccess: () => {
          setMachineId("");
          setShiftId("");
        },
        onError: (e) => setError(describeError(e)),
      },
    );
  };

  const cancelOrder = () => {
    setError(null);
    update.mutate(
      { id: wo.id, patch: { status: "cancelled" } },
      { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
    );
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="app-surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-[var(--radius-lg)] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                {wo.orderNumber} · {wo.garment}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--muted)]">
                Style {wo.styleCode} · {wo.quantityCompleted} of {wo.quantityTarget} done
              </Dialog.Description>
            </div>
            <StatusBadge status={wo.status} />
          </div>

          {!terminal && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Target quantity</h3>
              <div className="flex gap-2">
                <input className={inputClass} type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
                <Button variant="secondary" disabled={update.isPending} onClick={saveTarget}>
                  Save
                </Button>
              </div>
              <p className="text-xs text-[var(--muted)]">It cannot go below the {wo.quantityCompleted} pieces already completed.</p>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Where it runs</h3>
            {wo.assignments.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Not assigned yet. Operators only see work that is assigned to their line.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
                {wo.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{lineById.get(a.lineId)?.name ?? "Line"}</span>
                      <span className="text-[var(--muted)]">
                        {" · "}
                        {a.machineId ? (machines.find((m) => m.id === a.machineId)?.code ?? "Machine") : "Whole line"}
                        {" · "}
                        {a.shiftId ? (shifts.find((s) => s.id === a.shiftId)?.name ?? "Shift") : "All shifts"}
                      </span>
                    </span>
                    {!terminal && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={remove.isPending}
                        onClick={() => {
                          setError(null);
                          remove.mutate({ id: wo.id, assignmentId: a.id }, { onError: (e) => setError(describeError(e)) });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!terminal && (
              <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Line">
                    <select
                      className={inputClass}
                      value={lineId}
                      onChange={(e) => {
                        setLineId(e.target.value);
                        setMachineId("");
                      }}
                    >
                      <option value="">Choose…</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Machine">
                    <select className={inputClass} value={machineId} onChange={(e) => setMachineId(e.target.value)} disabled={!lineId}>
                      <option value="">Whole line</option>
                      {lineMachines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Shift">
                    <select className={inputClass} value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                      <option value="">All shifts</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Button variant="secondary" disabled={add.isPending} onClick={addAssignment}>
                  {add.isPending ? "Adding…" : "Add assignment"}
                </Button>
                <p className="text-xs text-[var(--muted)]">
                  Each operator terminal works on the most specific active order for its machine: machine + shift beats machine,
                  which beats line + shift, which beats the whole line.
                </p>
              </div>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
            {!terminal ? (
              confirmCancel ? (
                <div className="flex items-center gap-2 text-sm">
                  <span>Cancel this order for good?</span>
                  <Button size="sm" variant="destructive" disabled={update.isPending} onClick={cancelOrder}>
                    Yes, cancel it
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
                  Cancel work order
                </Button>
              )
            ) : (
              <span className="text-xs text-[var(--muted)]">Completed and cancelled orders are read-only.</span>
            )}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function WorkOrdersPage() {
  const { data: me } = useSession();
  const list = useWorkOrderList();
  const lines = useLinesList();
  const update = useUpdateWorkOrder();
  const [filter, setFilter] = useState<WorkOrderStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<LiveWorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = list.data ?? [];
  const lineById = useMemo(() => new Map((lines.data ?? []).map((l) => [l.id, l])), [lines.data]);
  const managed = all.find((w) => w.id === manageId) ?? null;
  const busyId = update.isPending ? update.variables?.id : undefined;

  const counts: Record<string, number> = { all: all.length };
  for (const s of STATUSES) counts[s] = all.filter((w) => w.status === s).length;

  const visible = (filter === "all" ? all : all.filter((w) => w.status === filter))
    .slice()
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.plannedStart.localeCompare(a.plannedStart));

  const changeStatus = useCallback(
    (id: string, to: WorkOrderStatus, onDone?: () => void) => {
      setError(null);
      update.mutate(
        { id, patch: { status: to } },
        { onSuccess: onDone, onError: (e) => setError(describeError(e)) },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update.mutate],
  );

  const columns = useMemo<ColumnDef<LiveWorkOrder, unknown>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-data font-medium">{row.original.orderNumber}</span>
            <span className="text-xs text-[var(--muted)]">
              {row.original.garment} · {row.original.styleCode}
            </span>
          </div>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const { quantityCompleted: done, quantityTarget: target } = row.original;
          const width = target > 0 ? Math.min(100, (done / target) * 100) : 0;
          return (
            <div className="flex min-w-44 flex-col gap-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
              </div>
              <span className="font-data text-xs text-[var(--muted)]">
                {done} / {target} · {formatPercent(done, target)}
              </span>
            </div>
          );
        },
      },
      {
        id: "planned",
        header: "Planned",
        cell: ({ row }) => (
          <span className="text-xs">
            {fmtDate(row.original.plannedStart)}
            {row.original.plannedEnd ? ` → ${fmtDate(row.original.plannedEnd)}` : ""}
          </span>
        ),
      },
      {
        id: "assigned",
        header: "Assigned to",
        cell: ({ row }) => {
          const codes = [...new Set(row.original.lineIds.map((id) => lineById.get(id)?.code ?? "?"))];
          return codes.length ? (
            <span className="font-data text-xs">{codes.join(", ")}</span>
          ) : (
            <span className="text-xs text-[var(--status-idle)]">Not assigned</span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const wo = row.original;
          const busy = busyId === wo.id;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              {ROW_ACTIONS[wo.status].map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant={a.variant}
                  disabled={busy}
                  onClick={() => (a.confirm ? setCompleting(wo) : changeStatus(wo.id, a.to))}
                >
                  {a.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setManageId(wo.id)}>
                Manage
              </Button>
            </div>
          );
        },
      },
    ],
    [lineById, busyId, changeStatus],
  );

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Work Orders</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Plan production, assign it to the floor, and watch it complete.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
          New work order
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
          All · {counts.all}
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "primary" : "secondary"} onClick={() => setFilter(s)} className="capitalize">
            {s} · {counts[s]}
          </Button>
        ))}
      </div>

      {error && <ErrorState message={error} />}

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load work orders." onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          data={visible}
          columns={columns}
          emptyTitle={all.length === 0 ? "No work orders yet" : "No work orders with that status"}
          emptyBody={
            all.length === 0
              ? "Create an order when you are ready. It can only run on the floor after a line exists in Floor setup."
              : undefined
          }
          emptyActionLabel={all.length === 0 && me?.role === "admin" ? "Open floor setup" : undefined}
          emptyActionHref={all.length === 0 && me?.role === "admin" ? "/admin/floor" : undefined}
        />
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {managed && <ManageDialog wo={managed} onClose={() => setManageId(null)} />}
      {completing && (
        <ConfirmDialog
          title="Complete this work order?"
          body={`${completing.orderNumber} will be marked completed with ${completing.quantityCompleted} of ${completing.quantityTarget} pieces. Operators can no longer record pieces against it.`}
          confirmLabel="Complete it"
          busy={update.isPending}
          onConfirm={() => changeStatus(completing.id, "completed", () => setCompleting(null))}
          onClose={() => setCompleting(null)}
        />
      )}
    </div>
  );
}