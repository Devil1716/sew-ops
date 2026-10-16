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
  CODE_PATTERN,
  Field,
  FormError,
  Modal,
  ModalActions,
  describeError,
  inputClass,
  normalizeCode,
  timezones,
} from "@/components/admin/kit";
import { useCreateFactory, useUpdateFactory } from "@/features/admin/hooks";
import { useFactoriesList, type LiveFactory } from "@/features/factories/hooks";

function FactoryModal({ factory, onClose }: { factory?: LiveFactory; onClose: () => void }) {
  const create = useCreateFactory();
  const update = useUpdateFactory();
  const zones = useMemo(() => timezones(), []);
  const [name, setName] = useState(factory?.name ?? "");
  const [code, setCode] = useState(factory?.code ?? "");
  const [timezone, setTimezone] = useState(factory?.timezone ?? "Asia/Kolkata");
  const [active, setActive] = useState(factory?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const busy = create.isPending || update.isPending;
  const deactivating = !!factory && factory.isActive && !active;

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    if (!factory) {
      const c = normalizeCode(code);
      if (!/^[A-Z0-9-]{2,20}$/.test(c)) return setError("The code needs 2 to 20 letters, numbers or dashes.");
      create.mutate(
        { name: name.trim(), code: c, timezone },
        { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
      );
    } else {
      update.mutate(
        { id: factory.id, patch: { name: name.trim(), timezone, isActive: active } },
        { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
      );
    }
  };

  return (
    <Modal
      title={factory ? "Edit factory" : "New factory"}
      description={factory ? undefined : "A factory has its own lines, machines, shifts and people."}
      onClose={onClose}
    >
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      {!factory && (
        <Field label="Code" hint="Short and permanent, for example MAIN. Letters, numbers and dashes.">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        </Field>
      )}
      <Field label="Timezone" hint="Shifts, reports and “today” follow this timezone.">
        <select className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Field>
      {factory && <CheckboxField checked={active} onChange={setActive} label="Active" />}
      {deactivating && (
        <p className="text-sm text-[var(--status-idle)]">
          Operators of an inactive factory cannot sign in at their terminals.
        </p>
      )}
      <FormError message={error} />
      <ModalActions onCancel={onClose} onSubmit={submit} busy={busy} submitLabel={factory ? "Save" : "Create factory"} />
    </Modal>
  );
}

export default function FactoriesPage() {
  const list = useFactoriesList();
  const [modal, setModal] = useState<{ factory?: LiveFactory } | null>(null);

  const columns = useMemo<ColumnDef<LiveFactory, unknown>[]>(
    () => [
      { id: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { id: "code", header: "Code", cell: ({ row }) => <span className="font-data">{row.original.code}</span> },
      { id: "tz", header: "Timezone", cell: ({ row }) => <span className="text-xs">{row.original.timezone}</span> },
      { id: "status", header: "Status", cell: ({ row }) => <ActivePill active={row.original.isActive} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setModal({ factory: row.original })}>
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
          <h1 className="text-3xl font-semibold tracking-tight">Factories</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Each factory has its own timezone, lines, machines and shifts.</p>
        </div>
        <Button variant="primary" onClick={() => setModal({})}>
          New factory
        </Button>
      </header>

      {list.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : list.isError ? (
        <ErrorState message="Could not load factories." onRetry={() => list.refetch()} />
      ) : (
        <DataTable data={list.data ?? []} columns={columns} emptyTitle="No factories yet" />
      )}

      {modal && <FactoryModal factory={modal.factory} onClose={() => setModal(null)} />}
    </div>
  );
}