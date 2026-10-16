"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data/EmptyState";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { StatusDot } from "@/components/data/StatusDot";
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
} from "@/components/admin/kit";
import {
  useAdminLines,
  useAdminMachines,
  useCreateLine,
  useCreateMachine,
  useUpdateLine,
  useUpdateMachine,
} from "@/features/admin/hooks";
import { useFactoriesList } from "@/features/factories/hooks";
import type { LiveLine } from "@/features/lines/hooks";
import type { LiveMachine } from "@/features/machines/live";
import { cn } from "@/lib/utils";

function LineModal({ factoryId, line, onClose }: { factoryId: string; line?: LiveLine; onClose: () => void }) {
  const create = useCreateLine();
  const update = useUpdateLine();
  const [name, setName] = useState(line?.name ?? "");
  const [code, setCode] = useState(line?.code ?? "");
  const [target, setTarget] = useState(String(line?.targetPerShift ?? 0));
  const [active, setActive] = useState(line?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const c = normalizeCode(code);
    const qty = Number(target);
    if (!name.trim()) return setError("Enter a name.");
    if (!CODE_PATTERN.test(c)) return setError("The code needs 1 to 20 letters, numbers or dashes.");
    if (!Number.isInteger(qty) || qty < 0) return setError("Target per shift must be a whole number, 0 or more.");
    const handlers = { onSuccess: onClose, onError: (e: unknown) => setError(describeError(e)) };
    if (!line) {
      create.mutate({ factoryId, name: name.trim(), code: c, targetPerShift: qty }, handlers);
    } else {
      update.mutate({ id: line.id, patch: { name: name.trim(), code: c, targetPerShift: qty, isActive: active } }, handlers);
    }
  };

  return (
    <Modal title={line ? "Edit line" : "New line"} onClose={onClose}>
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" hint="Letters, numbers, dashes.">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Target per shift">
          <input className={inputClass} type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
      </div>
      {line && <CheckboxField checked={active} onChange={setActive} label="Active" />}
      <FormError message={error} />
      <ModalActions
        onCancel={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        submitLabel={line ? "Save" : "Create line"}
      />
    </Modal>
  );
}

function MachineModal({
  lines,
  machine,
  lineId,
  onClose,
}: {
  lines: LiveLine[];
  machine?: LiveMachine;
  lineId?: string;
  onClose: () => void;
}) {
  const create = useCreateMachine();
  const update = useUpdateMachine();
  const [line, setLine] = useState(machine?.lineId ?? lineId ?? lines[0]?.id ?? "");
  const [name, setName] = useState(machine?.name ?? "");
  const [code, setCode] = useState(machine?.code ?? "");
  const [model, setModel] = useState(machine?.model ?? "");
  const [active, setActive] = useState(machine?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const c = normalizeCode(code);
    if (!line) return setError("Choose a line.");
    if (!name.trim()) return setError("Enter a name.");
    if (!CODE_PATTERN.test(c)) return setError("The code needs 1 to 20 letters, numbers or dashes.");
    const handlers = { onSuccess: onClose, onError: (e: unknown) => setError(describeError(e)) };
    if (!machine) {
      create.mutate({ lineId: line, name: name.trim(), code: c, model: model.trim() || undefined }, handlers);
    } else {
      update.mutate(
        { id: machine.id, patch: { lineId: line, name: name.trim(), code: c, model: model.trim() || null, isActive: active } },
        handlers,
      );
    }
  };

  return (
    <Modal
      title={machine ? "Edit machine" : "New machine"}
      description={machine ? "Status (running, idle, breakdown…) is set by the floor, not here." : undefined}
      onClose={onClose}
    >
      <Field label="Line">
        <select className={inputClass} value={line} onChange={(e) => setLine(e.target.value)}>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" hint="What the operator types at the terminal.">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
      </div>
      <Field label="Model (optional)">
        <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} maxLength={80} />
      </Field>
      {machine && <CheckboxField checked={active} onChange={setActive} label="Active" />}
      <FormError message={error} />
      <ModalActions
        onCancel={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        submitLabel={machine ? "Save" : "Create machine"}
      />
    </Modal>
  );
}

export default function FloorSetupPage() {
  const factories = useFactoriesList().data ?? [];
  const lines = useAdminLines();
  const machines = useAdminMachines();
  const [factoryId, setFactoryId] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [lineModal, setLineModal] = useState<{ line?: LiveLine } | null>(null);
  const [machineModal, setMachineModal] = useState<{ machine?: LiveMachine; lineId?: string } | null>(null);

  const activeFactory = factoryId || factories[0]?.id || "";
  const factoryLines = (lines.data ?? [])
    .filter((l) => l.factoryId === activeFactory)
    .sort((a, b) => a.code.localeCompare(b.code));
  const shownLines = showInactive ? factoryLines : factoryLines.filter((l) => l.isActive);
  const allMachines = machines.data ?? [];
  const loading = lines.isLoading || machines.isLoading;

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Floor setup</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Lines and the machines on them. Nothing is ever deleted: deactivate instead, so history stays intact.
          </p>
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
          <Button variant="primary" disabled={!activeFactory} onClick={() => setLineModal({})}>
            New line
          </Button>
        </div>
      </header>

      {loading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : lines.isError || machines.isError ? (
        <ErrorState message="Could not load the floor." onRetry={() => void Promise.all([lines.refetch(), machines.refetch()])} />
      ) : shownLines.length === 0 ? (
        <EmptyState title="No lines yet" body="Create the first line, then add the machines that sit on it." />
      ) : (
        shownLines.map((line) => {
          const lineMachines = allMachines
            .filter((m) => m.lineId === line.id && (showInactive || m.isActive))
            .sort((a, b) => a.code.localeCompare(b.code));
          return (
            <Card key={line.id} className={cn("space-y-3", !line.isActive && "opacity-70")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{line.name}</h2>
                    <span className="font-data text-xs text-[var(--muted)]">{line.code}</span>
                    {!line.isActive && <ActivePill active={false} />}
                  </div>
                  <p className="text-xs text-[var(--muted)]">Target per shift: {line.targetPerShift}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setLineModal({ line })}>
                    Edit line
                  </Button>
                  <Button size="sm" variant="primary" disabled={!line.isActive} onClick={() => setMachineModal({ lineId: line.id })}>
                    Add machine
                  </Button>
                </div>
              </div>
              {lineMachines.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No machines on this line yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
                  {lineMachines.map((m) => (
                    <li key={m.id} className={cn("flex items-center justify-between gap-3 px-3 py-2 text-sm", !m.isActive && "opacity-60")}>
                      <span className="flex flex-wrap items-center gap-3">
                        <StatusDot status={m.status} />
                        <span className="font-data">{m.code}</span>
                        <span>{m.name}</span>
                        {m.model && <span className="text-xs text-[var(--muted)]">{m.model}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        {!m.isActive && <ActivePill active={false} />}
                        <Button size="sm" variant="ghost" onClick={() => setMachineModal({ machine: m })}>
                          Edit
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}

      {lineModal && <LineModal factoryId={activeFactory} line={lineModal.line} onClose={() => setLineModal(null)} />}
      {machineModal && (
        <MachineModal
          lines={factoryLines.filter((l) => l.isActive || l.id === machineModal.machine?.lineId)}
          machine={machineModal.machine}
          lineId={machineModal.lineId}
          onClose={() => setMachineModal(null)}
        />
      )}
    </div>
  );
}