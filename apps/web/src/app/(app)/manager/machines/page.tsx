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
import { useLineProgress } from "@/features/kpis/hooks";
import { useMachineBoard, type LiveMachine } from "@/features/machines/live";
import { timeAgo } from "@/lib/time";

const STATUSES: MachineStatus[] = ["running", "idle", "breakdown", "maintenance", "offline"];

export default function MachinesPage() {
  const t = useTranslations();
  const machines = useMachineBoard();
  const lines = useLineProgress();
  const [filter, setFilter] = useState<MachineStatus | "all">("all");
  const [now, setNow] = useState(() => Date.now());

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

  const groups = new Map<string, LiveMachine[]>();
  for (const m of visible) {
    const g = groups.get(m.lineId) ?? [];
    g.push(m);
    groups.set(m.lineId, g);
  }
  const ordered = [...groups.entries()].sort((a, b) =>
    (lineNames.get(a[0]) ?? "").localeCompare(lineNames.get(b[0]) ?? ""),
  );

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

      {machines.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : machines.isError ? (
        <ErrorState message="Could not load machines." onRetry={() => machines.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          title="No machines yet"
          body="An admin adds lines and machines. They appear here as soon as they exist."
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
                  </Card>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}