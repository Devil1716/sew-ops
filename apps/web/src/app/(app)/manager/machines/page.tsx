"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MACHINE_STATUS_META, type MachineStatus } from "@sew-ops/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data/EmptyState";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { StatusDot } from "@/components/data/StatusDot";
import { Field, FormError, Modal, ModalActions, describeError, inputClass } from "@/components/admin/kit";
import { useLineProgress } from "@/features/kpis/hooks";
import { useSession } from "@/lib/auth/session";
import { useMachineBoard, type LiveMachine } from "@/features/machines/live";
import { useSetMaintenance } from "@/features/machines/maintenance";
import { timeAgo } from "@/lib/time";

const STATUSES: MachineStatus[] = ["running", "idle", "breakdown", "maintenance", "offline"];

function StartMaintenanceModal({ machine, onClose }: { machine: LiveMachine; onClose: () => void }) {
  const set = useSetMaintenance();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title={`Maintenance on ${machine.code}`}
      description="The machine is marked as in maintenance until you end it. The time is recorded as planned downtime, and operators cannot record pieces on it meanwhile (they can still report issues)."
      onClose={onClose}
    >
      <Field label="What is being done? (optional, kept in the audit log)">
        <input className={inputClass} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <FormError message={error} />
      <ModalActions
        onCancel={onClose}
        onSubmit={() =>
          set.mutate(
            { id: machine.id, on: true, note: note.trim() },
            { onSuccess: onClose, onError: (e) => setError(describeError(e)) },
          )
        }
        busy={set.isPending}
        submitLabel="Start maintenance"
      />
    </Modal>
  );
}

export default function MachinesPage() {
  const t = useTranslations();
  const { data: me } = useSession();
  const machines = useMachineBoard();
  const lines = useLineProgress();
  const set = useSetMaintenance();
  const [filter, setFilter] = useState<MachineStatus | "all">("all");
  const [now, setNow] = useState(() => Date.now());
  const [startFor, setStartFor] = useState<LiveMachine | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const all = machines.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUSES) c[s] = all.filter((m) => m.status === s).length;
    return c;
  }, [all]);

  const lineNames = new Map((lines.data ?? []).map((l) => [l.lineId, l.lineName]));
  const visible = filter === "all" ? all : all.filter((m) => m.status === filter);
  const busyId = set.isPending ? set.variables?.id : undefined;

  const groups = new Map<string, LiveMachine[]>();
  for (const m of visible) {
    const g = groups.get(m.lineId) ?? [];
    g.push(m);
    groups.set(m.lineId, g);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    (lineNames.get(a[0]) ?? "").localeCompare(lineNames.get(b[0]) ?? ""),
  );

  const endMaintenance = (m: LiveMachine) => {
    setError(null);
    set.mutate({ id: m.id, on: false }, { onError: (e) => setError(describeError(e)) });
  };

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Machines board</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Status of every machine on the floor, updated live.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
            All · {counts.all}
          </Button>
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={filter === s ? "primary" : "secondary"} onClick={() => setFilter(s)}>
              {t(MACHINE_STATUS_META[s].labelKey)} · {counts[s]}
            </Button>
          ))}
        </div>
      </header>

      {error && <ErrorState message={error} />}

      {machines.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : machines.isError ? (
        <ErrorState message="Could not load machines." onRetry={() => machines.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          title="No machines yet"
          body="Machines are added in Floor setup, and a line has to exist first. They show up here as soon as they do."
          actionLabel={me?.role === "admin" ? "Open floor setup" : undefined}
          actionHref={me?.role === "admin" ? "/admin/floor" : undefined}
        />
      ) : visible.length === 0 ? (
        <EmptyState title="No machines with that status" />
      ) : (
        ordered.map(([lineId, group]) => (
          <section key={lineId} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              {lineNames.get(lineId) ?? "Line"} · {group.length}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {group
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((m) => (
                  <Card
                    key={m.id}
                    className="space-y-2 border-l-4"
                    style={{ borderLeftColor: MACHINE_STATUS_META[m.status].colorVar }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-data text-lg font-semibold">{m.code}</span>
                      <StatusDot status={m.status} />
                    </div>
                    <div className="text-sm">{m.name}</div>
                    <div className="font-data text-xs text-[var(--muted)]">{timeAgo(m.lastEventAt, now)}</div>
                    <div className="pt-1">
                      {m.status === "maintenance" ? (
                        <Button size="sm" variant="secondary" disabled={busyId === m.id} onClick={() => endMaintenance(m)}>
                          {busyId === m.id ? "Ending…" : "End maintenance"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setStartFor(m)}>
                          Maintenance
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          </section>
        ))
      )}

      {startFor && <StartMaintenanceModal machine={startFor} onClose={() => setStartFor(null)} />}
    </div>
  );
}