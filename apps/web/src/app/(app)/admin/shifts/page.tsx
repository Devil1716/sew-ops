"use client";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data/DataTable";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import {
  ActivePill,
  CheckboxField,
  Field,
  FormError,
  Modal,
  ModalActions,
  describeError,
  inputClass,
} from "@/components/admin/kit";
import { useAdminShifts, useCreateShift, useUpdateShift } from "@/features/admin/hooks";
import { useFactoriesList } from "@/features/factories/hooks";
import type { LiveShift } from "@/features/shifts/hooks";

function ShiftModal({ factoryId, shift, onClose }: { factoryId: string; shift?: LiveShift; onClose: () => void }) {
  const create = useCreateShift();
  const update = useUpdateShift();
  const [name, setName] = useState(shift?.name ?? "");
  const [startsAt, setStartsAt] = useState(shift?.startsAt ?? "06:00");
  const [endsAt, setEndsAt] = useState(shift?.endsAt ?? "14:00");
  const [active, setActive] = useState(shift?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    if (!startsAt || !endsAt) return setError("Choose a start and an end time.");
    if (startsAt === endsAt) return setError("The start and end time cannot be the same.");
    const handlers = { onSuccess: onClose, onError: (e: unknown) => setError(describeError(e)) };
    if (!shift) {
      create.mutate({ factoryId, name: name.trim(), startsAt, endsAt }, handlers);
    } else {
      update.mutate({ id: shift.id, patch: { name: name.trim(), startsAt, endsAt, isActive: active } }, handlers);
    }
  };

  return (
    <Modal
      title={shift ? "Edit shift" : "New shift"}
      description="Times are on the factory's clock. A shift that ends earlier than it starts runs overnight."
      onClose={onClose}
    >
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <input className={inputClass} type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Ends">
          <input className={inputClass} type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
      </div>
      {shift && <CheckboxField checked={active} onChange={setActive} label="Active" />}
      <FormError message={error} />
      <ModalActions
        onCancel={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        submitLabel={shift ? "Save" : "Create shift"}
      />
    </Modal>
  );
}

export default function ShiftsPage() {
  const factories = useFactoriesList().data ?? [];
  const list = useAdminShifts();
  const [factoryId, setFactoryId] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<{ shift?: LiveShift } | null>(null);

  const activeFactory = factoryId || factories[0]?.id || "";
  const rows = (list.data ?? [])
    .filter((s) => s.factoryId === activeFactory && (showInactive || s.isActive))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const columns = useMemo<ColumnDef<LiveShift, unknown>[]>(
    () => [
      { id: "name", header: "Shift", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        id: "hours",
        header: "Hours",
        cell: ({ row }) => (
          <span className="font-data">
            {row.original.startsAt} – {row.original.endsAt}
            {row.original.startsAt > row.original.endsAt && (
              <span className="ml-2 text-xs text-[var(--muted)]">overnight</span>
            )}
          </span>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <ActivePill active={row.original.isActive} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setModal({ shift: row.original })}>
              Edit
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
          <h1 className="text-3xl font-semibold tracking-tight">Shifts</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">When each shift runs. Operators sign in against the shift that is running now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {factories.length > 1 && (
            <select className={`${inputClass} w-auto`} value={activeFactory} onChange={(e) => setFactoryId(e.target.value)}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <CheckboxField checked={showInactive} onChange={setShowInactive} label="Show inactive" />
          <Button variant="primary" disabled={!activeFactory} onClick={() => setModal({})}>
            New shift
          </Button>
        </div>
      </header>

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load shifts." onRetry={() => list.refetch()} />
      ) : (
        <DataTable data={rows} columns={columns} emptyTitle="No shifts yet. Create the first one." />
      )}

      {modal && <ShiftModal factoryId={activeFactory} shift={modal.shift} onClose={() => setModal(null)} />}
    </div>
  );
}