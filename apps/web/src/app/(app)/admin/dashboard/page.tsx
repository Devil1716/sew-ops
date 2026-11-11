"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, Boxes, Building2, Clock3, Cpu, Factory, Settings2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { useFactoriesList } from "@/features/factories/hooks";
import { useAdminLines, useAdminMachines, useAdminShifts } from "@/features/admin/hooks";

export default function AdminDashboardPage() {
  const factories = useFactoriesList();
  const lines = useAdminLines();
  const machines = useAdminMachines();
  const shifts = useAdminShifts();
  const loading = factories.isLoading || lines.isLoading || machines.isLoading || shifts.isLoading;
  const failed = factories.isError || lines.isError || machines.isError || shifts.isError;
  const refresh = () => void Promise.all([factories.refetch(), lines.refetch(), machines.refetch(), shifts.refetch()]);

  const activeFactories = (factories.data ?? []).filter((item) => item.isActive);
  const activeLines = (lines.data ?? []).filter((item) => item.isActive);
  const activeMachines = (machines.data ?? []).filter((item) => item.isActive);
  const activeShifts = (shifts.data ?? []).filter((item) => item.isActive);
  const machineStatus = [
    { label: "Running", count: activeMachines.filter((item) => item.status === "running").length, color: "var(--status-running)" },
    { label: "Idle", count: activeMachines.filter((item) => item.status === "idle").length, color: "var(--status-idle)" },
    { label: "Needs attention", count: activeMachines.filter((item) => item.status === "breakdown" || item.status === "maintenance").length, color: "var(--status-breakdown)" },
  ];

  const stats = [
    { label: "Active factories", value: activeFactories.length, detail: `${(factories.data ?? []).length} total sites`, icon: Building2, tint: "lavender" },
    { label: "Production lines", value: activeLines.length, detail: "Across all sites", icon: Activity, tint: "blue" },
    { label: "Active machines", value: activeMachines.length, detail: "Configured on the floor", icon: Cpu, tint: "peach" },
    { label: "Shift schedules", value: activeShifts.length, detail: "Ready for assignment", icon: Clock3, tint: "mint" },
  ];

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--text)_78%,var(--accent))]">Admin workspace · Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Your production network</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">A clear view of factory setup, floor capacity, and shift coverage.</p>
        </div>
        <Link href="/admin/factories" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium shadow-[var(--shadow-1)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]">
          Manage factories <ArrowUpRight className="h-4 w-4 text-[var(--accent)]" />
        </Link>
      </header>

      {failed ? <ErrorState message="Could not load the admin overview." onRetry={refresh} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {stats.map(({ label, value, detail, icon: Icon, tint }) => (
          <Card key={label} className={`admin-stat admin-stat-${tint} relative overflow-hidden`}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-[var(--muted)]">{label}</p>{loading ? <div className="mt-3 h-9 w-16 animate-pulse rounded-lg bg-[var(--border)]" /> : <p className="mt-2 font-data text-4xl font-semibold tracking-tight">{value}</p>}<p className="mt-2 text-xs text-[var(--muted)]">{detail}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-[var(--accent)] shadow-[var(--shadow-1)]"><Icon className="h-5 w-5" /></span></div>
          </Card>
        ))}
      </div>

      {loading ? <Card><RowSkeleton count={4} /></Card> : !failed ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="space-y-5">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Factory portfolio</h2><p className="mt-1 text-sm text-[var(--muted)]">Sites connected to your SewOps workspace.</p></div><Building2 className="h-5 w-5 text-[var(--accent)]" /></div>
            {(factories.data ?? []).length ? <div className="space-y-2">{factories.data?.slice(0, 5).map((factory, index) => <div key={factory.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/45 p-3.5"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-orange-100 text-orange-700", "bg-emerald-100 text-emerald-700", "bg-pink-100 text-pink-700"][index % 5]}`}><Factory className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{factory.name}</p><p className="mt-0.5 font-data text-[10px] text-[var(--muted)]">{factory.code} · {factory.timezone}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${factory.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{factory.isActive ? "Active" : "Inactive"}</span></div>)}</div> : <p className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">No factories are configured yet.</p>}
            <Link href="/admin/factories" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)]">View all factories <ArrowUpRight className="h-4 w-4" /></Link>
          </Card>

          <Card className="space-y-5">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold tracking-tight">Machine status</h2><p className="mt-1 text-sm text-[var(--muted)]">Current state of active machines.</p></div><Cpu className="h-5 w-5 text-[var(--accent)]" /></div>
            <div className="space-y-4">{machineStatus.map((item) => <div key={item.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span><span className="font-data font-medium">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full" style={{ width: activeMachines.length ? `${(item.count / activeMachines.length) * 100}%` : "0%", background: item.color }} /></div></div>)}</div>
            <div className="grid grid-cols-2 gap-2 pt-2"><Link href="/admin/floor" className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white/45 px-3 py-3 text-xs font-medium transition hover:bg-white/80"><Cpu className="h-4 w-4 text-[var(--accent)]" /> Floor setup</Link><Link href="/admin/assignments" className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white/45 px-3 py-3 text-xs font-medium transition hover:bg-white/80"><Boxes className="h-4 w-4 text-[var(--accent)]" /> Assignments</Link></div>
          </Card>
        </div>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Settings2 className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold">Workspace controls</h2><p className="mt-1 text-xs text-[var(--muted)]">Manage people, shifts, and your change history.</p></div></div>
        <div className="flex flex-wrap gap-2">{[["Users", "/admin/users", Users], ["Shifts", "/admin/shifts", Clock3], ["Audit log", "/admin/audit-log", Boxes]].map(([label, href, Icon]) => { const ItemIcon = Icon as typeof Users; return <Link key={label as string} href={href as string} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/55 px-3 py-2 text-xs font-medium transition hover:bg-white/90"><ItemIcon className="h-3.5 w-3.5 text-[var(--accent)]" />{label as string}</Link>; })}</div>
      </Card>
    </div>
  );
}
