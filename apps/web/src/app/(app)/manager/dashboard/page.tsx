"use client";
import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/data/KpiCard";
import { KpiSkeleton, RowSkeleton } from "@/components/data/Skeletons";
import { ErrorState } from "@/components/data/ErrorState";
import { EmptyState } from "@/components/data/EmptyState";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/data/StatusDot";
import { EChart } from "@/components/charts/EChart";
import {
  useDashboardKpis,
  useDowntimeToday,
  useLineProgress,
  useOutputTrend,
} from "@/features/kpis/hooks";
import { useMachines } from "@/features/machines/hooks";
import { useOpenIssues } from "@/features/issues/hooks";
import { formatCount, formatPercent } from "@/lib/utils";
import type { Machine } from "@sew-ops/shared";

export default function DashboardPage() {
  const t = useTranslations();
  const kpis = useDashboardKpis();
  const lp = useLineProgress();
  const machines = useMachines();
  const issues = useOpenIssues();
  const trend = useOutputTrend();
  const downtime = useDowntimeToday();

  const nothingYet = kpis.data && kpis.data.target === 0 && kpis.data.completed === 0;

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1">
        <div>
          <p className="font-data text-[10px] uppercase tracking-[0.2em] text-[var(--accent)]">Manager workspace · Live overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Production at a glance</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">A shared view of today’s output, machine activity, and issues across the floor.</p>
        </div>
        <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-[var(--shadow-1)]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-running)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--status-running)_14%,transparent)]" />
          <span className="font-medium">Floor status</span><span className="text-[var(--muted)]">Live</span>
        </div>
      </header>
      {/* Filter bar */}
      <div className="app-surface flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5 text-xs text-[var(--muted)]">
        {["filterDate", "filterLine", "filterMachine", "filterGarment", "filterShift"].map((k) => (
          <button
            key={k}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1 hover:text-[var(--text)]"
          >
            {t(`dashboard.${k}`)}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {kpis.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : kpis.isError ? (
          <div className="md:col-span-6">
            <ErrorState onRetry={() => kpis.refetch()} />
          </div>
        ) : (
          <>
            <KpiCard label={t("dashboard.target")} value={kpis.data?.target} />
            <KpiCard
              label={t("dashboard.completed")}
              value={kpis.data?.completed}
              colorVar="var(--status-running)"
            />
            <KpiCard label={t("dashboard.remaining")} value={kpis.data?.remaining} />
            <KpiCard
              label={t("dashboard.machinesActive")}
              value={kpis.data?.machinesActive}
              colorVar="var(--status-running)"
            />
            <KpiCard
              label={t("dashboard.machinesStopped")}
              value={kpis.data?.machinesStopped}
              colorVar="var(--status-breakdown)"
            />
            <KpiCard
              label={t("dashboard.issuesToday")}
              value={kpis.data?.issuesToday}
              colorVar="var(--accent)"
            />
          </>
        )}
      </div>

      {nothingYet && (
        <EmptyState
          title={t("dashboard.emptyTitle")}
          body={t("dashboard.emptyBody")}
          actionLabel={t("dashboard.emptyAction")}
          onAction={() => (window.location.href = "/manager/work-orders")}
        />
      )}

      {/* Line progress + Machine board */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.lineProgress")}</CardTitle>
          </CardHeader>
          {lp.isLoading ? (
            <RowSkeleton count={3} />
          ) : !lp.data?.length ? (
            <EmptyState title="No lines configured" />
          ) : (
            <ul className="space-y-3">
              {lp.data.map((l) => (
                <li key={l.lineId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{l.lineName}</span>
                    <span className="font-data text-[var(--muted)]">
                      {formatCount(l.completed)} / {formatCount(l.target)} ·{" "}
                      {formatPercent(l.completed, l.target)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full bg-[var(--accent)] transition-[width] duration-500"
                      style={{ width: formatPercent(l.completed, l.target) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{t("dashboard.machineBoard")}</CardTitle>
          </CardHeader>
          {machines.isLoading ? (
            <RowSkeleton count={4} />
          ) : !machines.data?.length ? (
            <EmptyState title="No machines" />
          ) : (
            <div className="grid grid-cols-4 gap-2 md:grid-cols-6 lg:grid-cols-8">
              {machines.data.slice(0, 48).map((m: Machine) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-2"
                >
                  <StatusDot status={m.status} showLabel={false} />
                  <span className="font-data text-xs">{m.code}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Issues + charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.liveIssues")}</CardTitle>
          </CardHeader>
          {issues.isLoading ? (
            <RowSkeleton count={5} />
          ) : !issues.data?.length ? (
            <EmptyState title="No active issues" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {issues.data.slice(0, 8).map((i) => (
                <li key={i.id} className="row-flash flex items-center justify-between py-2 text-sm">
                  <span className="flex flex-col">
                    <span>{t(`issue.${camelize(i.type)}`)}</span>
                    <span className="font-data text-xs text-[var(--muted)]">
                      {i.machineCode} · {i.lineName}
                    </span>
                  </span>
                  <span className="font-data text-xs text-[var(--muted)]">
                    {i.status} · {Math.round(i.durationMinutes)} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.outputTrend")}</CardTitle>
          </CardHeader>
          {trend.isLoading ? (
            <RowSkeleton count={4} />
          ) : !trend.data?.length ? (
            <EmptyState title="No trend data yet" />
          ) : (
            <EChart
              option={{
                grid: { left: 36, right: 10, top: 10, bottom: 24 },
                xAxis: { type: "category", data: trend.data.map((p) => p.ts.slice(11, 16)) },
                yAxis: { type: "value" },
                series: [
                  {
                    type: "line",
                    smooth: true,
                    showSymbol: false,
                    data: trend.data.map((p) => p.completed),
                    lineStyle: { color: "#FF5A1F", width: 2 },
                    areaStyle: { color: "rgba(255,90,31,0.08)" },
                  },
                ],
              }}
            />
          )}
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>{t("dashboard.downtimeBreakdown")}</CardTitle>
          </CardHeader>
          {downtime.isLoading ? (
            <RowSkeleton count={3} />
          ) : !downtime.data?.length ? (
            <EmptyState title="No downtime" />
          ) : (
            <EChart
              height={200}
              option={{
                tooltip: { trigger: "item" },
                series: [
                  {
                    type: "pie",
                    radius: ["55%", "80%"],
                    data: downtime.data.map((d) => ({ name: d.reason, value: d.minutes })),
                  },
                ],
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function camelize(snake: string) {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
