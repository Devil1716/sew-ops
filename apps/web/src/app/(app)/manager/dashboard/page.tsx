"use client";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/data/KpiCard";
import { KpiSkeleton, RowSkeleton } from "@/components/data/Skeletons";
import { ErrorState } from "@/components/data/ErrorState";
import { EmptyState } from "@/components/data/EmptyState";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/data/StatusDot";
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

// Lazy-load Apache ECharts wrapper to trim ~350 kB of initial bundle size
const EChart = dynamic(
  () => import("@/components/charts/EChart").then((m) => m.EChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[200px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] text-xs text-[var(--muted)]">
        <span className="pulse-dot mr-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
        Loading telemetry chart…
      </div>
    ),
  },
);

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
      {/* Filter bar */}
      <div className="app-surface flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--muted)]">
        {["filterDate", "filterLine", "filterMachine", "filterGarment", "filterShift"].map((k) => (
          <button
            key={k}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 transition-colors hover:text-[var(--text)] hover:border-[var(--accent)]"
          >
            {t(`dashboard.${k}`)}
          </button>
        ))}
      </div>

      {/* KPI row: responsive across 2, 3, and 6 columns */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {kpis.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : kpis.isError ? (
          <div className="col-span-2 sm:col-span-3 lg:col-span-6">
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
                <li
                  key={l.lineId}
                  className="space-y-1.5 rounded-[var(--radius-md)] p-2 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]"
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium truncate mr-2">{l.lineName}</span>
                    <span className="font-data text-xs text-[var(--muted)] shrink-0">
                      {formatCount(l.completed)} / {formatCount(l.target)} ·{" "}
                      {formatPercent(l.completed, l.target)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12 gap-2">
              {machines.data.slice(0, 48).map((m: Machine) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-2 transition-all hover:border-[var(--accent)]"
                >
                  <StatusDot status={m.status} showLabel={false} />
                  <span className="font-data text-[11px] truncate">{m.code}</span>
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
                    <span className="font-medium">{t(`issue.${camelize(i.type)}`)}</span>
                    <span className="font-data text-xs text-[var(--muted)]">
                      {i.machineCode} · {i.lineName}
                    </span>
                  </span>
                  <span className="font-data text-xs text-[var(--muted)] shrink-0">
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

